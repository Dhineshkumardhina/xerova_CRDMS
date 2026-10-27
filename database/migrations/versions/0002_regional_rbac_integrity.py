"""regional RBAC, foreign keys, and integrity indexes

Revision ID: 0002_regional_rbac_integrity
Revises: 0001_initial_schema
Create Date: 2026-10-27 10:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_regional_rbac_integrity'
down_revision: Union[str, None] = '0001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. users: state, district, region + indexes
    user_cols = {c['name'] for c in inspector.get_columns('users')}
    user_idxs = {i['name'] for i in inspector.get_indexes('users')}

    with op.batch_alter_table('users') as batch_op:
        if 'state' not in user_cols:
            batch_op.add_column(sa.Column('state', sa.String(length=100), nullable=True))
        if 'district' not in user_cols:
            batch_op.add_column(sa.Column('district', sa.String(length=100), nullable=True))
        if 'region' not in user_cols:
            batch_op.add_column(sa.Column('region', sa.String(length=100), nullable=True))
        
        if 'ix_users_state' not in user_idxs:
            batch_op.create_index('ix_users_state', ['state'])
        if 'ix_users_district' not in user_idxs:
            batch_op.create_index('ix_users_district', ['district'])
        if 'ix_users_region' not in user_idxs:
            batch_op.create_index('ix_users_region', ['region'])

    # 2. police_stations: region + index
    ps_cols = {c['name'] for c in inspector.get_columns('police_stations')}
    ps_idxs = {i['name'] for i in inspector.get_indexes('police_stations')}

    with op.batch_alter_table('police_stations') as batch_op:
        if 'region' not in ps_cols:
            batch_op.add_column(sa.Column('region', sa.String(length=100), nullable=True))
        if 'ix_police_stations_region' not in ps_idxs:
            batch_op.create_index('ix_police_stations_region', ['region'])

    # 3. criminals: police_station_id, district + FK and indexes
    crim_cols = {c['name'] for c in inspector.get_columns('criminals')}
    crim_idxs = {i['name'] for i in inspector.get_indexes('criminals')}
    crim_fks = {fk['referred_table'] for fk in inspector.get_foreign_keys('criminals')}

    with op.batch_alter_table('criminals') as batch_op:
        if 'police_station_id' not in crim_cols:
            batch_op.add_column(sa.Column('police_station_id', sa.String(length=36), nullable=True))
        if 'district' not in crim_cols:
            batch_op.add_column(sa.Column('district', sa.String(length=100), nullable=True))
        
        # In batch mode, re-declaring FK constraint ensures SQLite table rewrite includes the FK
        if 'police_stations' not in crim_fks:
            batch_op.create_foreign_key(
                'fk_criminals_police_station_id',
                'police_stations',
                ['police_station_id'],
                ['id'],
                ondelete='SET NULL'
            )

        if 'ix_criminals_police_station_id' not in crim_idxs:
            batch_op.create_index('ix_criminals_police_station_id', ['police_station_id'])
        if 'ix_criminals_district' not in crim_idxs:
            batch_op.create_index('ix_criminals_district', ['district'])
        if 'idx_criminals_station_deleted' not in crim_idxs:
            batch_op.create_index('idx_criminals_station_deleted', ['police_station_id', 'is_deleted'])

    # 4. cases: composite performance indexes
    case_idxs = {i['name'] for i in inspector.get_indexes('cases')}
    with op.batch_alter_table('cases') as batch_op:
        if 'idx_cases_station_status' not in case_idxs:
            batch_op.create_index('idx_cases_station_status', ['police_station_id', 'status'])
        if 'idx_cases_officer_status' not in case_idxs:
            batch_op.create_index('idx_cases_officer_status', ['lead_officer_id', 'status'])

    # 5. audit_logs: timestamp + user_id composite index
    audit_idxs = {i['name'] for i in inspector.get_indexes('audit_logs')}
    with op.batch_alter_table('audit_logs') as batch_op:
        if 'idx_audit_logs_timestamp_user' not in audit_idxs:
            batch_op.create_index('idx_audit_logs_timestamp_user', ['timestamp', 'user_id'])

def downgrade() -> None:
    with op.batch_alter_table('audit_logs') as batch_op:
        batch_op.drop_index('idx_audit_logs_timestamp_user')

    with op.batch_alter_table('cases') as batch_op:
        batch_op.drop_index('idx_cases_officer_status')
        batch_op.drop_index('idx_cases_station_status')

    with op.batch_alter_table('criminals') as batch_op:
        batch_op.drop_index('idx_criminals_station_deleted')
        batch_op.drop_index('ix_criminals_district')
        batch_op.drop_index('ix_criminals_police_station_id')
        batch_op.drop_constraint('fk_criminals_police_station_id', type_='foreignkey')
        batch_op.drop_column('district')
        batch_op.drop_column('police_station_id')

    with op.batch_alter_table('police_stations') as batch_op:
        batch_op.drop_index('ix_police_stations_region')
        batch_op.drop_column('region')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_index('ix_users_region')
        batch_op.drop_index('ix_users_district')
        batch_op.drop_index('ix_users_state')
        batch_op.drop_column('region')
        batch_op.drop_column('district')
        batch_op.drop_column('state')
