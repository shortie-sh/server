import Koa from 'koa';
import * as Sentry from "@sentry/node";
import { extractTraceparentData, Span, stripUrlQueryAndFragment} from "@sentry/tracing"
import domain from 'domain';
import Router from 'koa-router';
import websocket from 'koa-easy-ws';
import { RateLimit } from 'koa2-ratelimit';
import koaBody from 'koa-body'
import send from 'koa-send';
import wsHandler from './ws.mjs';
import api from './api/graphql/graphql.mjs'
import restHandler from './api/rest/rest.mjs'; 
import client from './redis.mjs'
import websocat from 'websocat';
import dotenv from 'dotenv';

// General Init
dotenv.config()
Sentry.init({ 
  dsn: "https://d369da56ff764895ba9c02b76d2ad193@o1072667.ingest.sentry.io/6071873", 
  tracesSampleRate: 1.0,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});

// Koa init

// Start GraphQL (Apollo) Server
await api.start()

// Init Koa and koa-router
const app = new Koa()
const router = new Router()

// Ratelimiters
const wsLimiter = RateLimit.middleware({
  interval: { min: 60 }, // 15 minutes = 15*60*1000
  max: 30, // limit each IP to 100 requests per interval
  statusCode: 1000,
  handler:
    async function (ctx) {
      let ws = await ctx.ws()
      ws.send("Too many requests")
      ws.close()
    }
});
const webLimiter = RateLimit.middleware({
  interval: { min: 60 }, // 15 minutes = 15*60*1000
  max: 30, // limit each IP to 30 requests per interval
});

// Sentry

//  not mandatory, but adding domains does help a lot with breadcrumbs
const requestHandler = (ctx, next) => {
  return new Promise((resolve, _) => {
    const local = domain.create();
    local.add(ctx);
    local.on("error", err => {
      ctx.status = err.status || 500;
      ctx.body = err.message;
      ctx.app.emit("error", err, ctx);
    });
    local.run(async () => {
      Sentry.getCurrentHub().configureScope(scope =>
        scope.addEventProcessor(event =>
          Sentry.Handlers.parseRequest(event, ctx.request, { user: false })
        )
      );
      await next();
      resolve();
    });
  });
};

// this tracing middleware creates a transaction per request
const tracingMiddleWare = async (ctx, next) => {
  const reqMethod = (ctx.method || "").toUpperCase();
  const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url);

  // connect to trace of upstream app
  let traceparentData;
  if (ctx.request.get("sentry-trace")) {
    traceparentData = extractTraceparentData(ctx.request.get("sentry-trace"));
  }

  const transaction = Sentry.startTransaction({
    name: `${reqMethod} ${reqUrl}`,
    op: "http.server",
    ...traceparentData,
  });

  ctx.__sentry_transaction = transaction;
  
  // We put the transaction on the scope so users can attach children to it
  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction);
  });

  ctx.res.on("finish", () => {
    // Push `transaction.finish` to the next event loop so open spans have a chance to finish before the transaction closes
    setImmediate(() => {
      // if using koa router, a nicer way to capture transaction using the matched route
      if (ctx._matchedRoute) {
        const mountPath = ctx.mountPath || "";
        transaction.setName(`${reqMethod} ${mountPath}${ctx._matchedRoute}`);
      }
      transaction.setHttpStatus(ctx.status);
      transaction.finish();
    });
  });

  await next();
};

app.on("error", (err, ctx) => {
    Sentry.withScope(function(scope) {
      scope.addEventProcessor(function(event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  });


// Enabling middleware
app
  .use(requestHandler)
  .use(tracingMiddleWare)
  .use(koaBody({
    parsedMethods: ['POST', 'PUT', 'PATCH', 'GET']
  }))
  .use(websocket())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(router.middleware())



// Routes 

// Main Route (WebSockets)
router.get('/', requestHandler, tracingMiddleWare, wsLimiter, wsHandler, async (ctx) => {
  // HTTP
  ctx.body = "welcome to shortie.sh"
}) 

// API Routes
router.all("/api/graphql/schema.gql", webLimiter, async (ctx) => send(ctx, "/api/graphql/schema.gql"))
router.all('/api/graphql', webLimiter, api.getMiddleware({path: "/api/graphql"}));
router.all("/api/rest/:path", webLimiter, await restHandler, async (ctx) => await send(ctx, "/api/rest/openapi.yml"))

// Redirect
router.get('/:ending', webLimiter, async (ctx, next) => {
  const url = await client.getAsync(ctx.params.ending)
  if(url == null) {ctx.url = null;} else {
    ctx.url = String(url);
  }
  return next()
}, 
ctx => {
    if(ctx.url != null) {
      ctx.redirect(ctx.url)
      ctx.status = 302;
    } else {
      ctx.body = "Unknown Ending";
      ctx.status = 404;
    }
  
})

// Koa listener
app.listen(3000, async () => {
  try {

    // Start error handling
    const transaction = Sentry.startTransaction({
      op: "other_servers",
      name: "Websocat",
    });
    Sentry.configureScope(scope => {
      scope.setSpan(transaction);
    });

    // Parse netcat requests and transfer them to WebSockets
    const nc_server = await websocat.create({
      listen: "tcp-l:0.0.0.0:31337",
      host: "ws://127.0.0.1:3000",
      oneMessage: true,
      noClose: true
    })

    // On Ctrl+C
    process.on('SIGINT', function() {
      nc_server.stop()
      transaction.finish()
      process.exit()
    }); 


  } catch(err) {
    // Handle Errors
    Sentry.captureException(e); 
    console.log(err) 
  }

  console.log(`shortie.sh is now listening at ${process.env.EXPOSED_URL}`)
});