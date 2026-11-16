FROM node:24.15.0-alpine3.22
WORKDIR /app
COPY server.mjs .
USER node
ENV NODE_ENV=production
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "server.mjs"]
