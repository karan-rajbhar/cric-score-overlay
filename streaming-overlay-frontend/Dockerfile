FROM --platform=linux/amd64 node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove existing node_modules and package-lock if they exist
RUN rm -rf node_modules package-lock.json

# Install dependencies without platform-specific flags
RUN npm install

# Copy source code and config files
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["npm", "run", "dev"]
