import { graphql } from 'graphql'
import{ schema, root, Redirect } from '../graphql/graphql.mjs'

export default async function restHandler(ctx, next) {
    switch (ctx.path) {
        case "/api/rest/redirect":
            switch(ctx.method) {
                case "GET": return await getRedirect(ctx)
                case "POST": return await createRedirect(ctx)
            }
            break;
        case "/api/rest/openapi.yml":
            return next()
    }
}
async function getRedirect(ctx) {
        const ending = ctx.query.ending
        const query = `
        query {
            getRedirect(ending: "${ending}") {
                url
                ending
            }
        }
        `
        let data;
        data = await graphql(schema, query, root)
        if(data.errors) {
            ctx.status = 500;
            throw new Error(data.errors[0].message)
        } else {
            if(data.data.getRedirect == null) {
                ctx.body = "Redirect not found"
                return ctx.status = 404;
            }
            ctx.body = JSON.stringify(data.data.getRedirect)
            return ctx.status = 200;
        }
}


async function createRedirect(ctx) {
    const body = ctx.request.body;
    const mutation = `
        mutation {
        createRedirect(url: "${String(body.url)}", ending: "${body.ending}") {
            url
            ending
        }
        }
    `
    const data = await graphql(schema, mutation, root)
    if(data.errors) {
        if(data.errors[0].extensions.code == "USER_INPUT_ERROR") {
            ctx.body = data.errors[0].message;
            if(data.errors[0].message == "Redirect already taken") {
            return ctx.status = 403;
            }
            return ctx.status = 400;
        } else {
            ctx.status = 500;
            throw new Error(data.errors[0].message)
        }
    } else {
    ctx.body = JSON.stringify(new Redirect(data.data.createRedirect.url, data.data.createRedirect.ending))
    return ctx.status = 201;
    }
}