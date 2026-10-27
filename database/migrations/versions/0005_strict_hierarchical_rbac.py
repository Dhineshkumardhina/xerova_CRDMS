"""Strict hierarchical RBAC and explicit criminal creation permissions

Revision ID: 0005_strict_hierarchical_rbac
Revises: 0004_persistent_token_blacklist
Create Date: 2026-10-27 14:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0005_strict_hierarchical_rbac'
down_revision: Union[str, None] = '0004_persistent_token_blacklist'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    # 1. Create user_permission_grants table
    if 'user_permission_grants' not in tables:
        op.create_table(
            'user_permission_grants',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('permission_code', sa.String(length=100), nullable=False),
            sa.Column('is_granted', sa.Boolean(), server_default='1', nullable=False),
            sa.Column('granted_by_id', sa.String(length=36), nullable=True),
            sa.Column('granted_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('revoked_by_id', sa.String(length=36), nullable=True),
            sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['granted_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.ForeignKeyConstraint(['revoked_by_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_user_permission_grants_user_id', 'user_permission_grants', ['user_id'])
        op.create_index('ix_user_permission_grants_perm_code', 'user_permission_grants', ['permission_code'])
        op.create_index('ix_user_permission_grants_is_granted', 'user_permission_grants', ['is_granted'])

    # 2. Add region and created_by_id to criminals table
    crim_cols = {c['name'] for c in inspector.get_columns('criminals')}
    crim_idxs = {i['name'] for i in inspector.get_indexes('criminals')}
    with op.batch_alter_table('criminals') as batch_op:
        if 'region' not in crim_cols:
            batch_op.add_column(sa.Column('region', sa.String(length=100), nullable=True))
        if 'created_by_id' not in crim_cols:
            batch_op.add_column(sa.Column('created_by_id', sa.String(length=36), nullable=True))
        if 'ix_criminals_region' not in crim_idxs:
            batch_op.create_index('ix_criminals_region', ['region'])
        if 'ix_criminals_created_by_id' not in crim_idxs:
            batch_op.create_index('ix_criminals_created_by_id', ['created_by_id'])

    # 3. Ensure criminal_records.create exists in permissions table
    perm_codes = {row[0] for row in bind.execute(sa.text("SELECT code FROM permissions")).fetchall()}
    if 'criminal_records.create' not in perm_codes:
        bind.execute(sa.text("""
            INSERT INTO permissions (id, code, name, description, created_at, updated_at)
            VALUES ('perm-criminal_records.create', 'criminal_records.create', 'Create Criminal Dossiers', 'Explicit permission to create new criminal profile dossiers (Super Admin authorization required)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """))

    # Ensure admin has both creation permissions
    admin_perms = {row[0] for row in bind.execute(sa.text("""
        SELECT p.code FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = 'role-admin'
    """)).fetchall()}
    for target_p in ['criminal_records.create', 'criminal:create']:
        if target_p not in admin_perms:
            p_id = bind.execute(sa.text("SELECT id FROM permissions WHERE code = :c"), {"c": target_p}).scalar()
            if p_id:
                bind.execute(sa.text("""
                    INSERT OR IGNORE INTO role_permissions (role_id, permission_id, created_at)
                    VALUES ('role-admin', :pid, CURRENT_TIMESTAMP)
                """), {"pid": p_id})

    # 4. Remove criminal creation permissions from non-superadmin roles
    bind.execute(sa.text("""
        DELETE FROM role_permissions
        WHERE role_id != 'role-admin'
        AND permission_id IN (
            SELECT id FROM permissions WHERE code IN ('criminal:create', 'criminal_records.create')
        )
    """))

def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if 'user_permission_grants' in tables:
        op.drop_table('user_permission_grants')

    with op.batch_alter_table('criminals') as batch_op:
        batch_op.drop_index('ix_criminals_created_by_id')
        batch_op.drop_index('ix_criminals_region')
        batch_op.drop_column('created_by_id')
        batch_op.drop_column('region')
