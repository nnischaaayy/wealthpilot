# Containerized FastAPI on Fly.io/Render (architecture.md §16) — a
# long-lived process for SSE streaming, unlike serverless-friendly
# apps/web. Multi-stage: build deps in one layer, run as non-root in a slim
# runtime layer.

FROM python:3.11-slim AS base

WORKDIR /app

FROM base AS deps
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM base AS runtime
RUN useradd --create-home --uid 1000 appuser
COPY --from=deps /root/.local /home/appuser/.local
COPY . .
RUN chown -R appuser:appuser /app
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=3)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
