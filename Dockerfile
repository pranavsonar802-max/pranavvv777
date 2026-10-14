# ==============================================================================
# PRANAV SONAR PORTFOLIO — PRODUCTION DOCKERFILE
# ==============================================================================

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Ensure data and reports storage exist
RUN mkdir -p /app/data/reports

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start production server
CMD ["node", "server.js"]
