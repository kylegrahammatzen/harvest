FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY src/ src/
COPY tsconfig.json ./

FROM base
COPY --from=install /app/node_modules node_modules
COPY --from=build /app/src src
COPY --from=build /app/package.json .
COPY --from=build /app/tsconfig.json .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
