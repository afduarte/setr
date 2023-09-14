FROM node:18 AS app
# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json /app/

RUN npm install
# If you are building your code for production
# RUN npm ci --omit=dev

# Express boilerplate
COPY bin /app/bin

# App src
COPY app.js /app/app.js
COPY routes /app/routes
COPY util /app/util

EXPOSE 3000
CMD ["node", "/app/bin/www"]