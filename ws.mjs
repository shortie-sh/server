import validator from "validator";
import { graphql } from "graphql";
import{ schema, root, Redirect } from './api/graphql/graphql.mjs'
import * as Sentry from '@sentry/node'

export default async function wsHandler(ctx, next) {
    if(ctx.ws) {
        const ws = await ctx.ws()
        if(ctx.__sentry_transaction) {
            ctx.span = ctx.__sentry_transaction.startChild({
                description: ws,
                op: "ctx.ws",
            });
        }
        ws.on('message', async (message) => {
            message = validator.rtrim(String(message))
            let red;
            if(message.split(" ")[1]) {
                red = new Redirect(message.split(" ")[0], message.split(" ")[1])
                return await createRedirect(red, ws)
            } else {
                red = new Redirect(message, null)
                return await createRedirect(red, ws)
            }
        })
        ws.on('close', async () => {
            if (ctx.span) {
                ctx.span.finish();
            }
        })
        ws.on("error", (err, ctx) => {
            Sentry.withScope(scope => {
                scope.addEventProcessor(event => {
                return Sentry.Handlers.parseRequest(event, ctx.request);
            });
            Sentry.captureException(err);
        });
      });
   
    } else {
        next()
    }
}

async function createRedirect(red, ws) {
    const mutation = `
        mutation {
        createRedirect(url: "${String(red.url)}", ending: "${red.ending}") {
            url
            ending
        }
        }
    `
    const data = await graphql(schema, mutation, root)
    if(data.errors) {
        if(data.errors[0].extensions.code == "USER_INPUT_ERROR") {
            ws.send(data.errors[0].message)
            return ws.close(1000, data.errors[0].message)
        } else {
            ws.send("Internal Server Error")
            ws.close(1011, "Internal Server Error")
            throw new Error(data.errors[0].message)
        }
    } else {
        ws.send(`${process.env.EXPOSED_URL}/${data.data.createRedirect.ending}`)
        return ws.close(1000)
    }


}
