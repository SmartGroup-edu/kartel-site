FROM node:24.15.0-alpine3.22
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs store.mjs policy.mjs crypto.mjs schema.sql ./
USER node
ENV NODE_ENV=production
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8789/healthz || exit 1
CMD ["node", "server.mjs"]
