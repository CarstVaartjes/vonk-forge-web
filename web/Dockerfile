# syntax=docker/dockerfile:1.7
FROM node:24.12.0-alpine AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/index.html web/tsconfig.json web/vite.config.ts ./
COPY web/src src
RUN npm run build

FROM caddy:2.10.2-alpine
COPY --chown=10001:10001 deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=10001:10001 /app/dist /srv
USER 10001:10001
EXPOSE 8080
