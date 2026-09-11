FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are embedded into the browser bundle during `next build`.
# Declare them here so production Docker builds use the same browser configuration
# as local development instead of relying on runtime container environment values.
ARG NEXT_PUBLIC_DEFAULT_API_KEY
ARG NEXT_PUBLIC_ESP32_IP
ARG NEXT_PUBLIC_ESP32_PORT
ARG NEXT_PUBLIC_ESP32_URL
ARG NEXT_PUBLIC_MQTT_WS_PASSWORD
ARG NEXT_PUBLIC_MQTT_WS_URL
ARG NEXT_PUBLIC_MQTT_WS_USERNAME
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ARG NEXT_PUBLIC_WS_PORT
ENV NEXT_PUBLIC_DEFAULT_API_KEY=$NEXT_PUBLIC_DEFAULT_API_KEY \
    NEXT_PUBLIC_ESP32_IP=$NEXT_PUBLIC_ESP32_IP \
    NEXT_PUBLIC_ESP32_PORT=$NEXT_PUBLIC_ESP32_PORT \
    NEXT_PUBLIC_ESP32_URL=$NEXT_PUBLIC_ESP32_URL \
    NEXT_PUBLIC_MQTT_WS_PASSWORD=$NEXT_PUBLIC_MQTT_WS_PASSWORD \
    NEXT_PUBLIC_MQTT_WS_URL=$NEXT_PUBLIC_MQTT_WS_URL \
    NEXT_PUBLIC_MQTT_WS_USERNAME=$NEXT_PUBLIC_MQTT_WS_USERNAME \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_WS_PORT=$NEXT_PUBLIC_WS_PORT

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "server.js"]
