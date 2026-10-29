FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends blender && rm -rf /var/lib/apt/lists/*
RUN apt-get update && apt-get install -y --no-install-recommends python3-numpy && rm -rf /var/lib/apt/lists/*
ENV BLENDER_PATH=/usr/bin/blender
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src/ ./src/
COPY blender/ ./blender/
USER node
EXPOSE 8091
CMD ["node", "src/server.mjs"]
