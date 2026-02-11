# syntax=docker/dockerfile:1

FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PORT=8080
ENV PORT=$PORT
RUN ["npm", "run", "build"]
CMD ["node", "./dist/index.js"]
EXPOSE $PORT
