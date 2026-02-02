FROM python:3.11-slim

WORKDIR /app

# Install system dependencies and Rust (needed for pydantic-core)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add Rust to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN . $HOME/.cargo/env && pip install --no-cache-dir -r requirements.txt

# Copy all backend code (app, auth, db, drive, models, etc.)
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
