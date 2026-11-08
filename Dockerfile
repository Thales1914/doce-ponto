FROM node:22-alpine AS base

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

USER node
EXPOSE 3000

# O boot da API aplica as migrations pendentes antes de escutar (idempotente).
CMD ["node", "src/server.js"]

# Testes disponíveis somente quando este estágio é solicitado explicitamente.
FROM base AS test
COPY tests ./tests
COPY scripts ./scripts
CMD ["npm", "test"]

FROM base AS production
