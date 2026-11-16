FROM node:22.18.0-alpine3.22
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs store.mjs validate.mjs images.mjs schema.sql ./
# The files volume is created from this path, so it inherits node ownership (else uploads hit EACCES).
RUN mkdir -p /data/media && chown node:node /data/media && chmod 700 /data/media
USER node
ENV NODE_ENV=production
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8788/healthz || exit 1
CMD ["node", "server.mjs"]
