# Placeholder Dockerfile for booking-svc — Story 0.1.
# Real multi-stage workspace build arrives in Story 0.10 / 0.12.
ARG NODE_VERSION=22-alpine

FROM node:${NODE_VERSION}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

COPY package.json ./
RUN pnpm install --prod

COPY dist ./dist

ENV NODE_ENV=production
EXPOSE 4003
CMD ["node", "dist/main"]
