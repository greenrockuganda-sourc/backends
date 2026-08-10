FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm via Corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml .npmrc ./

# Allow required dependency build scripts in CI and install dependencies
RUN corepack pnpm config set allowBuilds core-js,esbuild && \
    corepack pnpm config set allowBuilds.core-js true && \
    corepack pnpm config set allowBuilds.esbuild true && \
    corepack pnpm install --no-frozen-lockfile

COPY . ./

RUN corepack pnpm build

FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

EXPOSE 8080

CMD ["node", "server.js"]
