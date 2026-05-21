# ---------- FRONTEND BUILD ----------
FROM node:20-alpine AS frontend-builder

ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY ./frontend/package*.json ./

RUN npm ci --omit=dev

COPY ./frontend .

RUN npm run build


# ---------- BACKEND ----------
FROM node:20-alpine

ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY ./backend/package*.json ./

RUN npm ci --omit=dev

COPY ./backend .

COPY --from=frontend-builder /app/dist /app/public

EXPOSE 3000

CMD ["node", "server.js"]