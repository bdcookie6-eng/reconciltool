FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY index.html bankrec.html server.js ./

EXPOSE 80
CMD ["node", "server.js"]
