FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# IBM's supported Linux installer. Bob remains a server-side Aegis dependency.
RUN curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash \
    && bob --version

COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
