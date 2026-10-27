"""Persistent token blacklist table for immediate access-token revocation

Revision ID: 0004_persistent_token_blacklist
Revises: 0003_fir_case_investigation_workflow
Create Date: 2026-10-27 12:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0004_persistent_token_blacklist'
down_revision: Union[str, None] = '0003_fir_case_investigation_workflow'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if 'revoked_tokens' not in tables:
        op.create_table(
            'revoked_tokens',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('jti', sa.String(length=64), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=True),
            sa.Column('revoked_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_revoked_tokens_jti', 'revoked_tokens', ['jti'], unique=True)
        op.create_index('ix_revoked_tokens_user_id', 'revoked_tokens', ['user_id'])

def downgrade() -> None:
    op.drop_table('revoked_tokens')
