# ==========================================
# Multi-Stage Build: GeoMeasure Platform
# ==========================================

# Stage 1: Build Frontend Assets
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Python Geospatial Backend & Runner
FROM python:3.11-slim

# Install system geospatial C-libraries: GDAL, PROJ, GEOS
RUN apt-get update && apt-get install -y --no-install-recommends \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy python dependencies
COPY backend /app/backend
COPY scripts /app/scripts

# Install python requirements
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    pydantic \
    geopandas \
    shapely \
    pyproj \
    fiona \
    python-multipart \
    sqlalchemy \
    pytest \
    httpx

# Copy built frontend assets
COPY --from=frontend-builder /app/dist /app/dist

# Create data directories
RUN mkdir -p /app/data/uploads /app/data/processed /app/data/samples

# Generate sample datasets
RUN python /app/scripts/generate_samples.py

# Expose API and web ports
EXPOSE 8001 3000

ENV HOST=0.0.0.0
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8001"]
