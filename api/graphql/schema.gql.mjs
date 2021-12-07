import { buildSchema } from 'graphql';
const schema = buildSchema(`
type Redirect {
    url: String
    ending: String
}

type Query {
    getRedirect(ending: String): Redirect
}

type Mutation {
    createRedirect(url: String!, ending: String): Redirect
}
`)
export default schema