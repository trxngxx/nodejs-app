# Use the official Node.js image as the base image
FROM node:23.2.0-alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install all dependencies, including dev dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Install pino-pretty for log formatting
RUN npm install -g pino-pretty

# Expose both gRPC and HTTP ports
EXPOSE 50051 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the app with pino-pretty for formatted logs
CMD ["sh", "-c", "node server.js | pino-pretty"]