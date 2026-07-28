FROM python:3.12-slim AS builder

WORKDIR /build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements-prod.txt .

RUN pip wheel --no-cache-dir --wheel-dir /wheels -r requirements-prod.txt


FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/asuntia/.local/bin:${PATH}"

RUN addgroup --system asuntia \
    && adduser --system --ingroup asuntia --home /home/asuntia asuntia \
    && mkdir -p /app/storage \
    && chown asuntia:asuntia /app/storage

COPY --from=builder /wheels /wheels
COPY requirements-prod.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements-prod.txt \
    && rm -rf /wheels

COPY --chown=asuntia:asuntia app ./app
COPY --chown=asuntia:asuntia alembic ./alembic
COPY --chown=asuntia:asuntia alembic.ini .

USER asuntia

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
