FROM node:12
WORKDIR /app
COPY package.json /app
RUN npm install
EXPOSE 1337
COPY . /app
CMD node lab1.js