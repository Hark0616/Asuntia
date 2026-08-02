"""version legacy workflow routes

Revision ID: 24df9594e69c
Revises: edf17141b1a1
Create Date: 2026-07-29 19:14:48.129623

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24df9594e69c'
down_revision: Union[str, None] = 'edf17141b1a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Los expedientes legados ya avanzados conservan su ruta original. Sólo se
    # actualizan los que siguen intactos en el primer paso antiguo.
    op.get_bind().exec_driver_sql(
        """
        CREATE TEMP TABLE workflow_v1_upgrade ON COMMIT DROP AS
        SELECT a.id AS asunto_id
        FROM asuntos AS a
        WHERE a.ruta_codigo = 'insolvencia_persona_natural'
          AND a.paso_actual = 1
          AND a.flujo_estado = 'activo'
          AND (
              SELECT count(*)
              FROM asunto_pasos AS p
              WHERE p.asunto_id = a.id AND p.is_active = true
          ) = 5
          AND NOT EXISTS (
              SELECT 1
              FROM asunto_pasos AS p
              WHERE p.asunto_id = a.id
                AND p.is_active = true
                AND (
                    p.estado = 'completado'
                    OR p.completed_at IS NOT NULL
                    OR p.datos <> '{}'::jsonb
                )
          )
          AND EXISTS (
              SELECT 1
              FROM asunto_pasos AS p
              WHERE p.asunto_id = a.id
                AND p.codigo = 'radicacion'
                AND p.estado = 'activo'
                AND p.is_active = true
          )
        """
    )

    op.get_bind().exec_driver_sql(
        """
        UPDATE asuntos
        SET ruta_codigo = 'insolvencia_persona_natural:v1'
        WHERE ruta_codigo = 'insolvencia_persona_natural'
        """
    )

    # Se desplazan temporalmente los órdenes para respetar la restricción única.
    op.execute(
        """
        UPDATE asunto_pasos
        SET orden = orden + 100
        WHERE asunto_id IN (SELECT asunto_id FROM workflow_v1_upgrade)
          AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE asunto_pasos
        SET orden = orden - 98
        WHERE asunto_id IN (SELECT asunto_id FROM workflow_v1_upgrade)
          AND is_active = true
        """
    )

    op.get_bind().exec_driver_sql(
        """
        INSERT INTO asunto_pasos (
            id, firma_id, is_active, created_at, updated_at, created_by_id,
            asunto_id, orden, codigo, titulo, descripcion, estado, campos, datos
        )
        SELECT
            gen_random_uuid(), a.firma_id, true, now(), now(), a.created_by_id,
            a.id, 1, 'recepcion_evaluacion', 'Recepción y evaluación inicial',
            'Verifica identidad, conflicto de interés y viabilidad preliminar antes de preparar la solicitud.',
            'activo',
            '[
              {"clave":"identidad_verificada","etiqueta":"Identidad verificada","tipo":"boolean","requerido":true},
              {"clave":"conflicto_interes","etiqueta":"Control de conflicto","tipo":"select","requerido":true,"opciones":[
                {"valor":"sin_conflicto","etiqueta":"Sin conflicto identificado"},
                {"valor":"requiere_revision","etiqueta":"Requiere revisión"}
              ]},
              {"clave":"viabilidad_preliminar","etiqueta":"Viabilidad preliminar","tipo":"select","requerido":true,"opciones":[
                {"valor":"viable","etiqueta":"Viable"},
                {"valor":"condicionada","etiqueta":"Viable con condición"},
                {"valor":"informacion_insuficiente","etiqueta":"Información insuficiente"}
              ]},
              {"clave":"observaciones","etiqueta":"Observaciones de recepción","tipo":"textarea","requerido":true}
            ]'::jsonb,
            '{}'::jsonb
        FROM asuntos AS a
        JOIN workflow_v1_upgrade AS target ON target.asunto_id = a.id
        """
    )
    op.get_bind().exec_driver_sql(
        """
        INSERT INTO asunto_pasos (
            id, firma_id, is_active, created_at, updated_at, created_by_id,
            asunto_id, orden, codigo, titulo, descripcion, estado, campos, datos
        )
        SELECT
            gen_random_uuid(), a.firma_id, true, now(), now(), a.created_by_id,
            a.id, 2, 'preparacion_solicitud', 'Preparación de la solicitud',
            'Confirma que la información, los documentos y el escrito están listos para revisión y presentación.',
            'bloqueado',
            '[
              {"clave":"documentacion_completa","etiqueta":"Documentación inicial completa","tipo":"boolean","requerido":true},
              {"clave":"solicitud_revisada","etiqueta":"Solicitud revisada por abogado","tipo":"boolean","requerido":true},
              {"clave":"observaciones","etiqueta":"Observaciones de preparación","tipo":"textarea","requerido":true}
            ]'::jsonb,
            '{}'::jsonb
        FROM asuntos AS a
        JOIN workflow_v1_upgrade AS target ON target.asunto_id = a.id
        """
    )

    op.execute(
        """
        UPDATE asunto_pasos
        SET estado = 'bloqueado', updated_at = now()
        WHERE asunto_id IN (SELECT asunto_id FROM workflow_v1_upgrade)
          AND codigo = 'radicacion'
          AND is_active = true
        """
    )
    op.execute(
        """
        UPDATE tareas AS t
        SET asunto_paso_id = first_step.id,
            codigo = 'paso:recepcion_evaluacion',
            titulo = 'Completar recepción y evaluación inicial',
            instruccion = first_step.descripcion,
            updated_at = now()
        FROM asunto_pasos AS first_step
        WHERE t.asunto_id IN (SELECT asunto_id FROM workflow_v1_upgrade)
          AND t.asunto_id = first_step.asunto_id
          AND first_step.codigo = 'recepcion_evaluacion'
          AND first_step.is_active = true
          AND t.codigo = 'paso:radicacion'
          AND t.estado IN ('pendiente', 'en_progreso')
        """
    )
    op.execute(
        """
        UPDATE asuntos
        SET ruta_codigo = 'insolvencia_persona_natural:v2',
            paso_actual = 1,
            etapa_actual = 'Paso 1 de 7: Recepción y evaluación inicial',
            siguiente_paso = 'Verifica identidad, conflicto de interés y viabilidad preliminar antes de preparar la solicitud.',
            updated_at = now()
        WHERE id IN (SELECT asunto_id FROM workflow_v1_upgrade)
        """
    )

    op.alter_column(
        "asuntos",
        "ruta_codigo",
        existing_type=sa.String(length=80),
        server_default="insolvencia_persona_natural:v2",
        existing_nullable=False,
    )
    op.create_index(
        "uq_asunto_paso_activo",
        "asunto_pasos",
        ["asunto_id"],
        unique=True,
        postgresql_where=sa.text("estado = 'activo' AND is_active = true"),
    )

def downgrade() -> None:
    op.drop_index(
        "uq_asunto_paso_activo",
        table_name="asunto_pasos",
        postgresql_where=sa.text("estado = 'activo' AND is_active = true"),
    )
    op.alter_column(
        "asuntos",
        "ruta_codigo",
        existing_type=sa.String(length=80),
        server_default="insolvencia_persona_natural",
        existing_nullable=False,
    )
    op.execute(
        """
        UPDATE asuntos
        SET ruta_codigo = 'insolvencia_persona_natural'
        WHERE ruta_codigo = 'insolvencia_persona_natural:v1'
        """
    )
