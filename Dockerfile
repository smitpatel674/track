FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tracking.js server.js ./

ENV HEADLESS=false
ENV PORT=3000

EXPOSE 3000

CMD ["xvfb-run", "--auto-servernum", "--server-args=-screen 0 1440x1000x24", "node", "server.js"]
