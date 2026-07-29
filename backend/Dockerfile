FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy dependency files first
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY . .

# Cloud Run uses port 8080
ENV PORT=8080

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]