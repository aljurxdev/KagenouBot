FROM node:20-alpine

RUN npm install

CMD ["node", "run.js"]
