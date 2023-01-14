import {createClient} from "redis";
import * as dotenv from 'dotenv';

dotenv.config()

export const getRedisClient = () => {
    const client = createClient({
        socket: {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT
        },
        database: process.env.REDIS_DB,
        password: process.env.REDIS_PASSWORD
    })

    client.on('error', err => {
        console.log('Error ' + err);
    });

    return client
}