# Use Node.js LTS
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and configuration
COPY . .

# Build the TypeScript code
RUN npm run build

# Copy necessary files
RUN cp -r drizzle dist/ && \
    cp -r src/db/schema.ts dist/db/ && \
    chmod +x dist/db/migrate.js

# Install production dependencies only
RUN npm ci --only=production

# Set environment to production
ENV NODE_ENV=production

# Expose the port the app runs on
EXPOSE 3002

# Run the application
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/app.js"]
