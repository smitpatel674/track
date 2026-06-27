FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tracking.js server.js start.sh ./
RUN chmod +x start.sh

ENV HEADLESS=false
ENV PORT=3000

EXPOSE 3000

CMD ["./start.sh"]
