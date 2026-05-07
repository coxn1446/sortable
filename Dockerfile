# Single-stage Dockerfile for Cloud Run.
# Build: gcloud run deploy sortable --source .
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
RUN npm run build

# Prune devDependencies to keep the runtime image small.
RUN npm prune --omit=dev

FROM node:20-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public
COPY --from=build /app/serverIndex.js ./serverIndex.js
COPY --from=build /app/package.json ./package.json

EXPOSE 8080

CMD ["node", "serverIndex.js"]
