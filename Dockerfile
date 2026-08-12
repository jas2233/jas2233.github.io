FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY src/data ./src/data
COPY src/services/sse.js ./src/services/sse.js

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["node", "server/index.js"]
