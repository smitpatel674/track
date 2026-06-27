FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tracking.js ./

ENV HEADLESS=true

CMD ["npm", "start"]
