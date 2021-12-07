FROM node:17.2.0
WORKDIR /app
COPY . /app
RUN npm install
CMD node index.mjs