FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY index.html bankrec.html marketingbot.html server.js ./
COPY data/ ./data/

EXPOSE 80
CMD ["node", "server.js"]
