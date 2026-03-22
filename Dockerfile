FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN npm install

COPY shared/ shared/
COPY server/ server/

RUN npx tsc --build --force server/tsconfig.json

CMD ["node", "server/dist/index.js"]
