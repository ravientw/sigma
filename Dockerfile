# Base image with Node.js
FROM node:20-slim

# Install system dependencies (Python3, pip, and ffmpeg)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install latest yt-dlp globally
RUN pip3 install --break-system-packages "yt-dlp[default]"

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
