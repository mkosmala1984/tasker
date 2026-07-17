FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ghcr.io/static-web-server/static-web-server:2-alpine

ENV SERVER_PORT=8080
COPY --chown=sws:sws --from=build /app/dist /var/public
