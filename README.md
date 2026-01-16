# Backend for [chat-app](https://github.com/yxxr1/chat-app)

Deps: 
- mongodb
- redis (optional, define `REDIS_URL` env) for sync multiple instances

[Envs](src/config/common.ts):
- `PORT`: app port, default 8080
- `CORS_URL`: frontend url, value of `Access-Control-Allow-Origin` http header, default `http://localhost:3000`
- `MONGO_URL`: mongodb url, default `mongodb://127.0.0.1/`
- `MONGO_DB_NAME`: mongodb db name, default `chat-db`
- `REDIS_URL`: redis url, default not specified, can be `redis://127.0.0.1/` for local redis instance
- `REDIS_CHANNEL_NAME`: redis pub/sub channel name, default `chat-broadcast-sync`
- `JWT_ACCESS_SECRET`: JWT access token secret key
- `JWT_REFRESH_SECRET`: JWT refresh token secret key

Start app:
- `npm i` to install deps
- `npm run start` to start app dev
- `npm run build && node ./dist/index.js` to start app prod
