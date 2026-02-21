FROM node:20-alpine
WORKDIR /app
COPY . .
RUN if [ -f package.json ]; then npm install --omit=dev; fi
EXPOSE 8081
CMD ["node","server.js"]