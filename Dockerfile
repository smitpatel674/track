FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tracking.js server.js ./

ENV HEADLESS=true
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
