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

# Copy all application code
COPY api ./api
COPY auth ./auth
COPY db ./db
COPY drive ./drive
COPY models ./models
COPY engine ./engine
COPY tax ./tax
COPY budget ./budget

EXPOSE 8000

# Run using api.main not app.main
CMD uvicorn api.main:app --host 0.0.0.0 --port $PORT