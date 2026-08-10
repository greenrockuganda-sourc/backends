FROM node:24-alpine AS builder

WORKDIR /app

# Install pnpm via Corepack
RUN corepack enable

# Use the dashboard package manifest and lockfile from the subdirectory
COPY DASHBAORD/package.json DASHBAORD/pnpm-lock.yaml ./

# Install dashboard dependencies
RUN corepack pnpm install --no-frozen-lockfile

COPY DASHBAORD ./

RUN corepack pnpm build

FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

EXPOSE 8080

CMD ["node", "server.js"]
