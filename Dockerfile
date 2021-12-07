FROM node:17.2.0
WORKDIR /app
COPY . /app
RUN npm install

EXPOSE 3000
EXPOSE 31337

CMD node index.mjs