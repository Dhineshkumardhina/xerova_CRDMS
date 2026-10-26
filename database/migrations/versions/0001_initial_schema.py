"""initial PostgreSQL database schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-23 19:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. roles
    op.create_table(
        'roles',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('ix_roles_name', 'roles', ['name'])

    # 2. permissions
    op.create_table(
        'permissions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_permissions_code', 'permissions', ['code'])

    # 3. role_permissions
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.String(length=36), nullable=False),
        sa.Column('permission_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )

    # 4. police_stations
    op.create_table(
        'police_stations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('station_code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=False),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('phone_number', sa.String(length=30), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('station_code')
    )
    op.create_index('ix_police_stations_station_code', 'police_stations', ['station_code'])
    op.create_index('ix_police_stations_name', 'police_stations', ['name'])
    op.create_index('ix_police_stations_district', 'police_stations', ['district'])
    op.create_index('ix_police_stations_state', 'police_stations', ['state'])

    # 5. users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=150), nullable=False),
        sa.Column('badge_number', sa.String(length=50), nullable=False),
        sa.Column('rank', sa.String(length=50), nullable=False, default='Detective'),
        sa.Column('department', sa.String(length=100), nullable=False, default='Homicide & Major Crimes Division'),
        sa.Column('clearance_level', sa.String(length=50), nullable=False, default='Level 4 - Top Secret'),
        sa.Column('avatar_url', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_superuser', sa.Boolean(), nullable=False, default=False),
        sa.Column('role_id', sa.String(length=36), nullable=True),
        sa.Column('police_station_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['police_station_id'], ['police_stations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('badge_number'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_badge_number', 'users', ['badge_number'])

    # 6. refresh_tokens
    op.create_table(
        'refresh_tokens',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('token', sa.String(length=500), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token')
    )
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('ix_refresh_tokens_token', 'refresh_tokens', ['token'])

    # 7. criminals
    op.create_table(
        'criminals',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('normalized_name', sa.String(length=150), nullable=False),
        sa.Column('alias', sa.String(length=150), nullable=True),
        sa.Column('father_name', sa.String(length=150), nullable=True),
        sa.Column('dob', sa.Date(), nullable=True),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('gender', sa.String(length=20), nullable=False, default='Male'),
        sa.Column('phone_number', sa.String(length=30), nullable=True),
        sa.Column('identification_number', sa.String(length=100), nullable=True),
        sa.Column('raw_id_number', sa.String(length=100), nullable=True),
        sa.Column('primary_address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('height', sa.String(length=30), nullable=True),
        sa.Column('weight', sa.String(length=30), nullable=True),
        sa.Column('eye_color', sa.String(length=30), nullable=True),
        sa.Column('hair_color', sa.String(length=30), nullable=True),
        sa.Column('mugshot_url', sa.String(length=500), nullable=True),
        sa.Column('mugshot_date', sa.String(length=50), nullable=True),
        sa.Column('risk_level', sa.String(length=30), nullable=False, default='Medium Risk'),
        sa.Column('status', sa.String(length=50), nullable=False, default='Active'),
        sa.Column('category', sa.String(length=100), nullable=False, default='Theft'),
        sa.Column('is_historical', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_archived', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('identification_number')
    )
    op.create_index('ix_criminals_name', 'criminals', ['name'])
    op.create_index('ix_criminals_normalized_name', 'criminals', ['normalized_name'])
    op.create_index('ix_criminals_phone_number', 'criminals', ['phone_number'])
    op.create_index('ix_criminals_identification_number', 'criminals', ['identification_number'])
    op.create_index('ix_criminals_primary_address', 'criminals', ['primary_address'])
    op.create_index('ix_criminals_city', 'criminals', ['city'])
    op.create_index('ix_criminals_state', 'criminals', ['state'])
    op.create_index('ix_criminals_status', 'criminals', ['status'])
    op.create_index('ix_criminals_category', 'criminals', ['category'])
    op.create_index('ix_criminals_is_archived', 'criminals', ['is_archived'])
    op.create_index('ix_criminals_is_deleted', 'criminals', ['is_deleted'])
    op.create_index('idx_criminal_search', 'criminals', ['normalized_name', 'status', 'city'])

    # 8. criminal_aliases
    op.create_table(
        'criminal_aliases',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('alias_name', sa.String(length=150), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_criminal_aliases_criminal_id', 'criminal_aliases', ['criminal_id'])
    op.create_index('ix_criminal_aliases_alias_name', 'criminal_aliases', ['alias_name'])

    # 9. identification_marks
    op.create_table(
        'identification_marks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, default='mark'),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('body_location', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_identification_marks_criminal_id', 'identification_marks', ['criminal_id'])

    # 10. criminal_photos
    op.create_table(
        'criminal_photos',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('photo_url', sa.String(length=500), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=True),
        sa.Column('is_primary_mugshot', sa.Boolean(), nullable=False, default=False),
        sa.Column('intake_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_criminal_photos_criminal_id', 'criminal_photos', ['criminal_id'])

    # 11. face_embeddings
    op.create_table(
        'face_embeddings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('photo_id', sa.String(length=36), nullable=True),
        sa.Column('embedding_vector', sa.JSON(), nullable=False),
        sa.Column('feature_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['photo_id'], ['criminal_photos.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_face_embeddings_criminal_id', 'face_embeddings', ['criminal_id'])

    # 12. crime_categories
    op.create_table(
        'crime_categories',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('severity_level', sa.String(length=30), nullable=False, default='Medium'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.UniqueConstraint('name')
    )
    op.create_index('ix_crime_categories_name', 'crime_categories', ['name'])
    op.create_index('ix_crime_categories_code', 'crime_categories', ['code'])

    # 13. cases
    op.create_table(
        'cases',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('case_number', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('date_filed', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, default='Under Investigation'),
        sa.Column('category', sa.String(length=100), nullable=False, default='Theft'),
        sa.Column('police_station_id', sa.String(length=36), nullable=True),
        sa.Column('lead_officer_id', sa.String(length=36), nullable=True),
        sa.Column('is_archived', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['lead_officer_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['police_station_id'], ['police_stations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('case_number')
    )
    op.create_index('ix_cases_case_number', 'cases', ['case_number'])
    op.create_index('ix_cases_date_filed', 'cases', ['date_filed'])
    op.create_index('ix_cases_status', 'cases', ['status'])
    op.create_index('ix_cases_category', 'cases', ['category'])
    op.create_index('ix_cases_police_station_id', 'cases', ['police_station_id'])
    op.create_index('ix_cases_lead_officer_id', 'cases', ['lead_officer_id'])
    op.create_index('ix_cases_is_archived', 'cases', ['is_archived'])
    op.create_index('ix_cases_is_deleted', 'cases', ['is_deleted'])

    # 14. case_categories
    op.create_table(
        'case_categories',
        sa.Column('case_id', sa.String(length=36), nullable=False),
        sa.Column('crime_category_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['crime_category_id'], ['crime_categories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('case_id', 'crime_category_id')
    )
    op.create_index('ix_case_categories_case_id', 'case_categories', ['case_id'])
    op.create_index('ix_case_categories_crime_category_id', 'case_categories', ['crime_category_id'])

    # 15. criminal_cases
    op.create_table(
        'criminal_cases',
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('case_id', sa.String(length=36), nullable=False),
        sa.Column('role_in_case', sa.String(length=100), nullable=False, default='Primary Suspect'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('criminal_id', 'case_id')
    )
    op.create_index('ix_criminal_cases_criminal_id', 'criminal_cases', ['criminal_id'])
    op.create_index('ix_criminal_cases_case_id', 'criminal_cases', ['case_id'])

    # 16. documents
    op.create_table(
        'documents',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=True),
        sa.Column('file_type', sa.String(length=50), nullable=False, default='pdf'),
        sa.Column('size', sa.String(length=50), nullable=False, default='1.0 MB'),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('file_hash_sha256', sa.String(length=64), nullable=True),
        sa.Column('date_uploaded', sa.String(length=50), nullable=False, default='Today'),
        sa.Column('uploaded_by_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_documents_file_hash_sha256', 'documents', ['file_hash_sha256'])

    # 17. criminal_documents
    op.create_table(
        'criminal_documents',
        sa.Column('criminal_id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['criminal_id'], ['criminals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('criminal_id', 'document_id')
    )
    op.create_index('ix_criminal_documents_criminal_id', 'criminal_documents', ['criminal_id'])
    op.create_index('ix_criminal_documents_document_id', 'criminal_documents', ['document_id'])

    # 18. case_documents
    op.create_table(
        'case_documents',
        sa.Column('case_id', sa.String(length=36), nullable=False),
        sa.Column('document_id', sa.String(length=36), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('case_id', 'document_id')
    )
    op.create_index('ix_case_documents_case_id', 'case_documents', ['case_id'])
    op.create_index('ix_case_documents_document_id', 'case_documents', ['document_id'])

    # 19. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('officer_name', sa.String(length=150), nullable=False, default='Authorized Officer'),
        sa.Column('action', sa.String(length=100), nullable=False),
        sa.Column('subject_name', sa.String(length=150), nullable=False),
        sa.Column('subject_id', sa.String(length=100), nullable=False),
        sa.Column('profile_id', sa.String(length=100), nullable=True),
        sa.Column('time', sa.String(length=50), nullable=True, default='Just now'),
        sa.Column('mugshot_url', sa.String(length=500), nullable=True),
        sa.Column('ip_address', sa.String(length=50), nullable=True),
        sa.Column('user_agent', sa.String(length=255), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_timestamp', 'audit_logs', ['timestamp'])
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'])
    op.create_index('ix_audit_logs_subject_id', 'audit_logs', ['subject_id'])

    # 20. search_metadata
    op.create_table(
        'search_metadata',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=True),
        sa.Column('query', sa.Text(), nullable=True),
        sa.Column('filters', sa.JSON(), nullable=True),
        sa.Column('results_count', sa.Integer(), nullable=False, default=0),
        sa.Column('execution_time_ms', sa.Float(), nullable=False, default=0.0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_search_metadata_user_id', 'search_metadata', ['user_id'])
    op.create_index('ix_search_metadata_created_at', 'search_metadata', ['created_at'])

def downgrade() -> None:
    op.drop_table('search_metadata')
    op.drop_table('audit_logs')
    op.drop_table('case_documents')
    op.drop_table('criminal_documents')
    op.drop_table('documents')
    op.drop_table('criminal_cases')
    op.drop_table('case_categories')
    op.drop_table('cases')
    op.drop_table('crime_categories')
    op.drop_table('face_embeddings')
    op.drop_table('criminal_photos')
    op.drop_table('identification_marks')
    op.drop_table('criminal_aliases')
    op.drop_table('criminals')
    op.drop_table('refresh_tokens')
    op.drop_table('users')
    op.drop_table('police_stations')
    op.drop_table('role_permissions')
    op.drop_table('permissions')
    op.drop_table('roles')
