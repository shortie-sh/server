import { createError } from 'apollo-errors';
import { ApolloError } from 'apollo-server-errors';

export class UserError extends Error {
  constructor(message) {
    super(message)
    this.graphql = new ApolloError(this.message, "USER_INPUT_ERROR")
  }
}