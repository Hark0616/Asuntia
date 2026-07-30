"""remove conflict check from workflow

Revision ID: 8d5db36e435d
Revises: 72c3aad083a9
Create Date: 2026-07-29 21:08:07.510509

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d5db36e435d'
down_revision: Union[str, None] = '72c3aad083a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE asunto_pasos
            SET campos = COALESCE(
                    (
                        SELECT jsonb_agg(
                            elemento.campo
                            ORDER BY elemento.posicion
                        )
                        FROM jsonb_array_elements(
                            asunto_pasos.campos
                        ) WITH ORDINALITY AS elemento(campo, posicion)
                        WHERE elemento.campo ->> 'clave'
                            <> 'conflicto_interes'
                    ),
                    '[]'::jsonb
                ),
                datos = datos - 'conflicto_interes',
                descripcion = (
                    'Verifica la identidad y la viabilidad preliminar '
                    'antes de preparar la solicitud.'
                )
            WHERE codigo = 'recepcion_evaluacion'
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE asuntos
            SET siguiente_paso = (
                'Verifica la identidad y la viabilidad preliminar '
                'antes de preparar la solicitud.'
            )
            WHERE siguiente_paso = (
                'Verifica identidad, conflicto de interés y viabilidad '
                'preliminar antes de preparar la solicitud.'
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE tareas
            SET instruccion = (
                'Verifica la identidad y la viabilidad preliminar '
                'antes de preparar la solicitud.'
            )
            WHERE instruccion = (
                'Verifica identidad, conflicto de interés y viabilidad '
                'preliminar antes de preparar la solicitud.'
            )
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE novedades
            SET descripcion = (
                'Validación interna de identidad y documentos disponibles '
                'antes de emitir una conclusión.'
            )
            WHERE descripcion = (
                'Validación interna de identidad, documentos disponibles '
                'y posibles conflictos antes de emitir una conclusión.'
            )
            """
        )
    )

def downgrade() -> None:
    # La eliminación es intencionalmente irreversible: el producto no debe
    # conservar ni reconstruir evaluaciones de conflicto de interés.
    pass
