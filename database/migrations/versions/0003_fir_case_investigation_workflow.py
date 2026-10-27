"""FIR registration, case management, and investigation activities

Revision ID: 0003_fir_case_investigation_workflow
Revises: 0002_regional_rbac_integrity
Create Date: 2026-10-27 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_fir_case_investigation_workflow'
down_revision: Union[str, None] = '0002_regional_rbac_integrity'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Add FIR and courtroom fields to cases table
    case_cols = {c['name'] for c in inspector.get_columns('cases')}
    with op.batch_alter_table('cases') as batch_op:
        if 'incident_date' not in case_cols:
            batch_op.add_column(sa.Column('incident_date', sa.String(length=50), nullable=True))
        if 'incident_location' not in case_cols:
            batch_op.add_column(sa.Column('incident_location', sa.String(length=255), nullable=True))
        if 'complainant_name' not in case_cols:
            batch_op.add_column(sa.Column('complainant_name', sa.String(length=150), nullable=True))
        if 'complainant_phone' not in case_cols:
            batch_op.add_column(sa.Column('complainant_phone', sa.String(length=50), nullable=True))
        if 'penal_code' not in case_cols:
            batch_op.add_column(sa.Column('penal_code', sa.String(length=100), nullable=True))
        if 'court_room' not in case_cols:
            batch_op.add_column(sa.Column('court_room', sa.String(length=150), nullable=True))
        if 'presiding_judge' not in case_cols:
            batch_op.add_column(sa.Column('presiding_judge', sa.String(length=150), nullable=True))
        if 'courtroom_notes' not in case_cols:
            batch_op.add_column(sa.Column('courtroom_notes', sa.Text(), nullable=True))
        if 'notes' not in case_cols:
            batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))
        if 'penalties' not in case_cols:
            batch_op.add_column(sa.Column('penalties', sa.String(length=255), nullable=True))

    # 2. Create case_activities table
    tables = set(inspector.get_table_names())
    if 'case_activities' not in tables:
        op.create_table(
            'case_activities',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('case_id', sa.String(length=36), nullable=False),
            sa.Column('officer_id', sa.String(length=36), nullable=True),
            sa.Column('activity_type', sa.String(length=50), nullable=False, server_default='Investigation Note'),
            sa.Column('title', sa.String(length=200), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['officer_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_case_activities_case_id', 'case_activities', ['case_id'])
        op.create_index('ix_case_activities_created_at', 'case_activities', ['created_at'])

def downgrade() -> None:
    op.drop_table('case_activities')

    with op.batch_alter_table('cases') as batch_op:
        batch_op.drop_column('penalties')
        batch_op.drop_column('notes')
        batch_op.drop_column('courtroom_notes')
        batch_op.drop_column('presiding_judge')
        batch_op.drop_column('court_room')
        batch_op.drop_column('penal_code')
        batch_op.drop_column('complainant_phone')
        batch_op.drop_column('complainant_name')
        batch_op.drop_column('incident_location')
        batch_op.drop_column('incident_date')
