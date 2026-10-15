"""general case identity and optional workflow

Revision ID: f112d368f6d4
Revises: 8d5db36e435d
Create Date: 2026-10-14 19:50:58.411300

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f112d368f6d4'
down_revision: Union[str, None] = '8d5db36e435d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Inspección de datos antes de aplicar la unicidad, incluidos los archivados.
    duplicate = op.get_bind().execute(sa.text("""
        SELECT firma_id FROM asuntos GROUP BY firma_id, radicado HAVING count(*) > 1 LIMIT 1
    """)).first()
    if duplicate:
        raise RuntimeError("Hay códigos internos duplicados por firma; resolverlos antes de migrar")
    op.add_column('asuntos', sa.Column('titulo', sa.String(length=255), nullable=True))
    op.add_column('asuntos', sa.Column('radicado_oficial', sa.String(length=100), nullable=True))
    op.execute("""
        UPDATE asuntos SET titulo = CASE
            WHEN ruta_codigo IN ('insolvencia_persona_natural', 'insolvencia_persona_natural:v1', 'insolvencia_persona_natural:v2')
            THEN 'Insolvencia Persona Natural' ELSE radicado END
    """)
    op.execute("""
        UPDATE asuntos a SET radicado_oficial = NULLIF(trim(p.datos->>'radicado_oficial'), '')
        FROM asunto_pasos p
        WHERE p.asunto_id = a.id AND p.firma_id = a.firma_id
          AND p.codigo = 'radicacion' AND p.estado = 'completado'
          AND length(trim(p.datos->>'radicado_oficial')) BETWEEN 1 AND 100
    """)
    op.alter_column('asuntos', 'titulo', nullable=False)
    op.alter_column('asuntos', 'ruta_codigo',
               existing_type=sa.VARCHAR(length=80),
               nullable=True,
               server_default=None)
    op.alter_column('asuntos', 'paso_actual',
               existing_type=sa.INTEGER(),
               nullable=True,
               server_default=None)
    op.alter_column('asuntos', 'flujo_estado',
               existing_type=sa.VARCHAR(length=30),
               nullable=True,
               server_default=None)
    op.create_unique_constraint('uq_asuntos_firma_codigo_interno', 'asuntos', ['firma_id', 'radicado'])
    # ### end Alembic commands ###

def downgrade() -> None:
    if op.get_bind().execute(sa.text("SELECT 1 FROM asuntos WHERE ruta_codigo IS NULL LIMIT 1")).first():
        raise RuntimeError("La versión anterior no admite expedientes sin guía; conservar datos y restaurar una copia compatible")
    op.drop_constraint('uq_asuntos_firma_codigo_interno', 'asuntos', type_='unique')
    op.alter_column('asuntos', 'flujo_estado',
               existing_type=sa.VARCHAR(length=30),
               nullable=False,
               server_default='activo')
    op.alter_column('asuntos', 'paso_actual',
               existing_type=sa.INTEGER(),
               nullable=False,
               server_default='1')
    op.alter_column('asuntos', 'ruta_codigo',
               existing_type=sa.VARCHAR(length=80),
               nullable=False,
               server_default='insolvencia_persona_natural:v2')
    op.drop_column('asuntos', 'radicado_oficial')
    op.drop_column('asuntos', 'titulo')
    # ### end Alembic commands ###
