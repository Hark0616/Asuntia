import enum
from sqlalchemy import Column, String, Boolean, Text, BigInteger, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel

class TipoDocumental(str, enum.Enum):
    ANEXO = "anexo"
    ESCRITO_SOLICITUD = "escrito_solicitud"
    AUTO_ADMISORIO = "auto_admisorio"
    ACTA_AUDIENCIA = "acta_audiencia"
    ACTA_ACUERDO = "acta_acuerdo"
    PODER = "poder"
    COMUNICACION_JUZGADO = "comunicacion_juzgado"
    OTRO = "otro"

class DocumentoAsunto(BaseModel):
    __tablename__ = "documentos_asunto"

    asunto_id = Column(UUID(as_uuid=True), ForeignKey("asuntos.id"), nullable=False, index=True)
    nombre_funcional = Column(String(255), nullable=False)
    tipo_documental = Column(String(50), nullable=False, default=TipoDocumental.OTRO.value)
    provider = Column(String(30), nullable=False, default="google_drive")
    external_file_id = Column(String(255), nullable=False)
    web_view_url = Column(Text, nullable=False)
    web_download_url = Column(Text, nullable=True)
    mime_type = Column(String(100), nullable=True)
    tamano_bytes = Column(BigInteger, nullable=True)
    compartido_con_cliente = Column(Boolean, nullable=False, default=False)
    estado_revision = Column(String(50), nullable=False, default="recibido")

    # Relación con Asunto
    asunto = relationship("Asunto", back_populates="documentos")
