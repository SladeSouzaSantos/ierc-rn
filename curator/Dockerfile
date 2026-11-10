FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --no-audit --no-fund --omit=dev
COPY src ./src
USER node
CMD ["npm","run","schedule"]
