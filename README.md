# shortie-server

The server component to a very nerdy url shortner

## UX

Just run `echo google.com | nc shortie.sh` in a terminal.

(You might need to install netcat)

If netcat complains about a port, use port 31337 or whatever port you specified in docker.

## APIs

shortie-server exposes two APIs:

- ### REST API

  The OpenAPI spec is available at api/rest/openapi.yml
  
  #### Endpoint: /api/rest/

- ### GraphQL API

  The GraphQL schema is available at api/graphql/schema.gql

  #### Endpoint: /api/graphql

  A sandbox is available when you visit the endpoint in a browser.

## Deployment

### Prerequisites:

  - Redis Server
  - Docker Runtime

### Running:

Use `docker run` to run the container and setting all env variables found in `.env.example`.

Ports 3000 and 31337 need to be exposed.
