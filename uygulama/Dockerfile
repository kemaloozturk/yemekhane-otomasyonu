FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
ENV TZ=Europe/Istanbul
EXPOSE 8000
CMD ["node", "src/server.js"]
