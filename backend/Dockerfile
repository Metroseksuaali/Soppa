# Monivaiheinen build. Build-konteksti = repo-juuri (näkee sekä frontend/ että backend/).

# --- 1. Frontend build ---
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build   # tuottaa /frontend/dist

# --- 2. Backend build ---
FROM node:20-slim AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/db ./db
RUN npm run build   # tuottaa /app/dist (dist/src, dist/db)

# --- 3. Runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
# Käännetty backend + migraatiot + seed
COPY --from=backend-build /app/dist ./dist
COPY backend/db/migrations ./db/migrations
# Buildattu frontend tarjoiltavaksi (backend etsii ../public suhteessa dist/src)
COPY --from=frontend /frontend/dist ./public

EXPOSE 8080
CMD ["node", "dist/src/index.js"]
