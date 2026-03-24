
FROM node:20-alpine

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Start the bot
CMD ["node", "run.js"]
