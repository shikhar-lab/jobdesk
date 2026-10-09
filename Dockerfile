FROM node:24-slim
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
# The database lives in /app/data. On your host, attach a persistent disk (volume) to this folder
# so saved jobs are not lost when the server restarts.
CMD ["node", "server.js"]
