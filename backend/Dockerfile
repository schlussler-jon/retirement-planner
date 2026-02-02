FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and Rust
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/root/.cargo/bin:${PATH}"

# Install Python dependencies
COPY requirements.txt .
RUN . $HOME/.cargo/env && pip install --no-cache-dir -r requirements.txt

# Copy all application code explicitly
COPY app ./app
COPY auth ./auth
COPY db ./db
COPY drive ./drive
COPY models ./models
COPY api ./api

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT