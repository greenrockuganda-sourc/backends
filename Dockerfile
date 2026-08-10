FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm via Corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Install dependencies with project-level allowBuilds config from pnpm-workspace.yaml
RUN corepack pnpm install --no-frozen-lockfile

COPY . ./

RUN corepack pnpm build

FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY server.js ./server.js

EXPOSE 8080

CMD ["node", "server.js"]
