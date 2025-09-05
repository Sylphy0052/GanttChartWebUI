FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl openssl-dev
WORKDIR /usr/src/app

FROM base AS deps
COPY package*.json ./
RUN npm ci

FROM base AS development
COPY apps/api/package.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate
COPY apps/api/. .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

FROM base AS builder
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]