FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json frontend/.npmrc ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/app backend/app
COPY backend/migrate_data.py backend/migrate_data.py
COPY --from=frontend /build/frontend/dist frontend/dist
RUN useradd --create-home asklearn && chown -R asklearn:asklearn /app
USER asklearn
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT}"]
