FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

# Install IBM Bob Shell through npm instead of the interactive installer.
# Authentication is intentionally NOT performed during image build.
RUN npm install -g bobshell \
    && bob --version

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

EXPOSE 10000

CMD ["node", "server.js"]