FROM node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY *.mjs ./
RUN mkdir /app/provisioning && chown node:node /app/provisioning
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]
