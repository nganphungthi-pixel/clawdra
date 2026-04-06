# Aloochaat - AI Coding Agent
# Multi-stage build for production deployment
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache git curl docker-cli

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S aloochaat && \
    adduser -S aloochaat -u 1001 -G aloochaat

# Create necessary directories
RUN mkdir -p /home/aloochaat/.aloochaat/memory && \
    chown -R aloochaat:aloochaat /home/aloochaat/.aloochaat && \
    chown -R aloochaat:aloochaat /app

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/home/aloochaat

# Expose ports
EXPOSE 3000 4000

# Switch to non-root user
USER aloochaat

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default command
CMD ["node", "dist/cli.js"]
