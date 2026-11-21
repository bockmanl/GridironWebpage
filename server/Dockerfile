FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY routes ./routes
COPY src ./src

EXPOSE 3000

CMD ["npm", "start"]
