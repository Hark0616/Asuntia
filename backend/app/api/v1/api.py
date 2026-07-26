from fastapi import APIRouter
from app.api.v1.endpoints import auth, asuntos, novedades, estados, clientes

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(asuntos.router, prefix="/asuntos", tags=["Asuntos / Expedientes"])
api_router.include_router(novedades.router, prefix="/novedades", tags=["Novedades"])
api_router.include_router(estados.router, prefix="/estados", tags=["Estados Procesales"])
api_router.include_router(clientes.router, prefix="/clientes", tags=["Clientes"])
