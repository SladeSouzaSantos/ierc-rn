FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --no-audit --no-fund --omit=dev
COPY src ./src
# Git checkouts made under umask 077 can carry 0600 .mjs files.
# Normalize ONLY bundled application source, never environment secrets.
RUN chmod -R a+rX /app/src
# Named Docker reports volume inherits this non-root ownership on first mount.
RUN mkdir -p /reports && chown node:node /reports
USER node
CMD ["npm","run","schedule"]
