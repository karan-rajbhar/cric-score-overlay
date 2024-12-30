# Install uv
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Change the working directory to the `app` directory
WORKDIR /app

# Copy the lockfile and `pyproject.toml` into the image
COPY uv.lock pyproject.toml ./

# Install uvicorn first
RUN pip install uvicorn

# Install dependencies
RUN uv sync --frozen --no-install-project

# Copy the project into the image
COPY . .

# Install the project in development mode
RUN uv pip install --system -e .

# Try running with python module path
CMD [ "python", "-m", "uvicorn", "src.streaming_overlay.main:socket_app", "--host", "0.0.0.0", "--port", "8000" ]
