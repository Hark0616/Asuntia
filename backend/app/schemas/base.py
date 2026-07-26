from pydantic import BaseModel, ConfigDict

class BaseSchemaResponse(BaseModel):
    """
    Esquema base de respuesta Pydantic v2.
    Garantiza from_attributes = True para la serialización de modelos ORM SQLAlchemy Async.
    """
    model_config = ConfigDict(from_attributes=True)
