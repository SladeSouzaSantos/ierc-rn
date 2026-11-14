FROM node:22-slim
WORKDIR /opt/app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && mkdir -p /opt/app/public/uploads && chown -R node:node /opt/app
USER node
EXPOSE 1337
CMD ["npm", "run", "start"]
