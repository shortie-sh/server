import schema from './schema.gql.mjs'
import * as func from '../../functions.mjs'
import { ApolloServer } from 'apollo-server-koa'
import client from '../../redis.mjs'
import { UserError } from '../../classes.mjs'
import { sanitizeUrl } from "@braintree/sanitize-url";
import normalizeUrl from "normalize-url";
import validator from 'validator';

class Redirect {
    constructor(url, ending) {
        this.url = url;
        if(ending == null) {
            this.ending = func.genEnding(6)
        } else {
            this.ending = ending
        }
    }
}

const root = {
    getRedirect: async (ending) => {
        const url = await client.getAsync(ending.ending)
        if(url == null) {
            return null;
        } else {
            return new Redirect(url, ending.ending)
        }
        
    },
    createRedirect: async (data) => {
        let url = sanitizeUrl(data.url)
        if (validator.isURL(url) == false || url == "about:blank") {
            throw new UserError("Invalid Redirect URL").graphql
        }
        url = normalizeUrl(url)

        if(data.ending != null) {
            if(await client.getAsync(data.ending) == null) {
                await client.setAsync(data.ending, url)
                return new Redirect(url,data.ending)
            } else {
                throw new UserError("Redirect already taken").graphql
            }
        } else {
           let ending = func.genEnding(6)
           while(await client.getAsync(ending) != null) {
            ending = func.genEnding(6)
          }
          await client.setAsync(ending, url)
          return new Redirect(url, ending)   
        }

    }
  };

export default new ApolloServer({
    schema: schema, 
    rootValue: root
});

export { schema, root, Redirect}
