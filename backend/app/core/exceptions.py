from fastapi import HTTPException, status

class DomainException(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)

class NotFoundException(DomainException):
    def __init__(self, detail: str = "Recurso no encontrado"):
        super().__init__(detail=detail, status_code=status.HTTP_404_NOT_FOUND)

class UnauthorizedException(DomainException):
    def __init__(self, detail: str = "No autorizado"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)

class ForbiddenException(DomainException):
    def __init__(self, detail: str = "Acceso denegado"):
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)
