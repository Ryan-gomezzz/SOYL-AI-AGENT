FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Expose port (if needed)
# EXPOSE 3001

# Start worker application
CMD ["npm", "run", "start"]

