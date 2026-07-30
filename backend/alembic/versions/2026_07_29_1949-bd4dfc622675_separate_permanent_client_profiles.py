"""separate permanent client profiles

Revision ID: bd4dfc622675
Revises: 472397b7561d
Create Date: 2026-07-29 19:49:46.917776

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd4dfc622675'
down_revision: Union[str, None] = '472397b7561d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('clientes',
    sa.Column('tipo_persona', sa.String(length=20), server_default='natural', nullable=False),
    sa.Column('tipo_documento', sa.String(length=20), server_default='CC', nullable=False),
    sa.Column('numero_documento', sa.String(length=50), nullable=False),
    sa.Column('numero_documento_normalizado', sa.String(length=50), nullable=False),
    sa.Column('nombre', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('telefono', sa.String(length=50), nullable=True),
    sa.Column('fecha_expedicion', sa.Date(), nullable=True),
    sa.Column('direccion', sa.String(length=255), nullable=True),
    sa.Column('direccion_notificacion', sa.String(length=255), nullable=True),
    sa.Column('ciudad', sa.String(length=120), nullable=True),
    sa.Column('departamento', sa.String(length=120), nullable=True),
    sa.Column('canal_preferido', sa.String(length=20), server_default='email', nullable=False),
    sa.Column('observaciones', sa.Text(), nullable=True),
    sa.Column('portal_user_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('firma_id', sa.UUID(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_by_id', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['portal_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('portal_user_id')
    )
    op.create_index(op.f('ix_clientes_email'), 'clientes', ['email'], unique=False)
    op.create_index(op.f('ix_clientes_firma_id'), 'clientes', ['firma_id'], unique=False)
    op.create_index(op.f('ix_clientes_is_active'), 'clientes', ['is_active'], unique=False)
    op.create_index(op.f('ix_clientes_numero_documento'), 'clientes', ['numero_documento'], unique=False)
    op.create_index('uq_clientes_firma_documento', 'clientes', ['firma_id', 'numero_documento_normalizado'], unique=True)

    # Conserva la identidad de todos los clientes existentes. Los usuarios con
    # rol cliente pasan a ser únicamente sus cuentas opcionales de portal.
    op.execute(
        """
        INSERT INTO clientes (
            id,
            firma_id,
            is_active,
            created_at,
            updated_at,
            created_by_id,
            tipo_persona,
            tipo_documento,
            numero_documento,
            numero_documento_normalizado,
            nombre,
            email,
            telefono,
            canal_preferido,
            portal_user_id
        )
        SELECT
            id,
            firma_id,
            is_active,
            created_at,
            updated_at,
            created_by_id,
            CASE WHEN cedula ~ '[A-Za-z-]' THEN 'juridica' ELSE 'natural' END,
            CASE WHEN cedula ~ '[A-Za-z-]' THEN 'NIT' ELSE 'CC' END,
            cedula,
            lower(regexp_replace(cedula, '[^[:alnum:]]', '', 'g')),
            nombre,
            email,
            telefono,
            'email',
            id
        FROM users
        WHERE rol = 'cliente'
        """
    )
    op.drop_constraint(op.f('asuntos_cliente_id_fkey'), 'asuntos', type_='foreignkey')
    op.create_foreign_key(
        'fk_asuntos_cliente_id_clientes',
        'asuntos',
        'clientes',
        ['cliente_id'],
        ['id'],
    )

def downgrade() -> None:
    # Materializa como usuarios legados los perfiles creados después de la
    # separación para que ningún asunto quede sin referencia al revertir.
    op.execute(
        """
        INSERT INTO users (
            id,
            firma_id,
            is_active,
            created_at,
            updated_at,
            created_by_id,
            email,
            hashed_password,
            nombre,
            cedula,
            rol,
            telefono
        )
        SELECT
            c.id,
            c.firma_id,
            c.is_active,
            c.created_at,
            c.updated_at,
            c.created_by_id,
            c.email,
            NULL,
            c.nombre,
            c.numero_documento,
            'cliente',
            c.telefono
        FROM clientes c
        LEFT JOIN users u ON u.id = c.id
        WHERE u.id IS NULL
        """
    )
    op.execute(
        """
        UPDATE asuntos a
        SET cliente_id = COALESCE(c.portal_user_id, c.id)
        FROM clientes c
        WHERE a.cliente_id = c.id
        """
    )
    op.drop_constraint(
        'fk_asuntos_cliente_id_clientes', 'asuntos', type_='foreignkey'
    )
    op.create_foreign_key(op.f('asuntos_cliente_id_fkey'), 'asuntos', 'users', ['cliente_id'], ['id'])
    op.drop_index('uq_clientes_firma_documento', table_name='clientes')
    op.drop_index(op.f('ix_clientes_numero_documento'), table_name='clientes')
    op.drop_index(op.f('ix_clientes_is_active'), table_name='clientes')
    op.drop_index(op.f('ix_clientes_firma_id'), table_name='clientes')
    op.drop_index(op.f('ix_clientes_email'), table_name='clientes')
    op.drop_table('clientes')
