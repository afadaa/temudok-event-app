# =============================================
# Stage 1: Builder
# Build the React/Vite frontend
# =============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDeps needed for build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the Vite frontend (output → /app/dist)
RUN npm run build

# =============================================
# Stage 2: Production Runner
# Run the Express server with built static files
# =============================================
FROM node:20-alpine AS production

WORKDIR /app

# Set node environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev

# Copy the compiled frontend from builder stage
COPY --from=builder /app/dist ./dist

# Copy server source files
COPY server.ts ./
COPY server/ ./server/
COPY tsconfig.json ./

# Copy firebase config if exists (will be overridden by env vars in production)
COPY firebase-applet-config.json ./

# Create uploads directory
RUN mkdir -p public/uploads

# Expose application port
EXPOSE 3000

# Use tsx to run TypeScript server directly in production
CMD ["npx", "tsx", "server.ts"]
