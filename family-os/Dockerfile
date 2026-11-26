FROM node:24.15.0-alpine3.22
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server.mjs store.mjs policy.mjs crypto.mjs recur.mjs heif.mjs engine.mjs runner.mjs council.mjs board.mjs board-jobs.mjs migrate.mjs migrate-3c.mjs reminders.mjs reminders-job.mjs relay-sign.mjs kodeks.mjs adoption.mjs photo.mjs passkeys.mjs security-notices.mjs health.mjs body.mjs body-keys.mjs signin.mjs schema.sql roles.sql ./
# Encrypted document files live on this volume (created from this path, so node owns it).
RUN mkdir -p /data/docs && chown node:node /data/docs && chmod 700 /data/docs
USER node
ENV NODE_ENV=production
EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8789/healthz || exit 1
CMD ["node", "server.mjs"]
