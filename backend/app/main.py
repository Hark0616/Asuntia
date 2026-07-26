from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title="Asuntia API",
    description="API REST para la gestión de procesos de insolvencia de persona natural (FastAPI + Async SQLAlchemy)",
    version="0.1.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# Configuración CORS estricta
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "service": "asuntia-api"
    }

from app.api.v1.api import api_router

# Router principal v1
app.include_router(api_router, prefix="/api/v1")

