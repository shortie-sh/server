import redis from 'redis'
import { promisify } from 'util'
import dotenv from 'dotenv'
dotenv.config()

const client = redis.createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASS,
    db: 0
});
client.on("error", function(error) {
  console.error(error);
});

client.getAsync = promisify(client.get).bind(client);
client.setAsync = promisify(client.set).bind(client)

export default client

