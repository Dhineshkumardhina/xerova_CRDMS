import logging
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.role_permission import RoleModel, PermissionModel, RolePermissionModel
from app.models.police_station import PoliceStationModel
from app.models.user import UserModel
from app.models.criminal import CriminalProfileModel
from app.models.case import CaseRecordModel, CrimeCategoryModel

logger = logging.getLogger("db_migrations")

# All explicit permission definitions
SYSTEM_PERMISSIONS = [
    # Criminal Permissions
    ("criminal_records.create", "Create Criminal Dossiers", "Explicit permission to create new criminal profile dossiers (Super Admin authorization required)"),
    ("criminal:create", "Create Criminal Dossiers (Legacy)", "Permission to create new criminal profile dossiers"),
    ("criminal:read", "View Criminal Dossiers", "Permission to view and search criminal profile dossiers"),
    ("criminal:update", "Update Criminal Dossiers", "Permission to modify criminal profile dossiers"),
    ("criminal:delete", "Delete Criminal Dossiers", "Permission to soft/hard delete criminal profile dossiers"),
    ("criminal:archive", "Archive Criminal Dossiers", "Permission to archive and unarchive criminal dossiers"),
    ("criminal:export", "Export Criminal Records", "Permission to export criminal records, reports, and summaries"),
    ("criminal:view_sensitive", "View Sensitive Records", "Permission to view undercover intel and high-clearance notes"),
    
    # Case Permissions
    ("case:create", "Create Cases", "Permission to file and register new criminal cases / FIRs"),
    ("case:read", "View Cases", "Permission to view and read case records within jurisdiction"),
    ("case:update", "Update Cases", "Permission to update case progress and investigation details"),
    ("case:delete", "Delete Cases", "Permission to remove or expunge case records"),
    ("case:assign", "Assign Lead Officers", "Permission to assign or reassign case lead investigators"),
    ("case:approve", "Approve Case Status", "Permission to approve case closure, warrant issuance, or court filings"),
    ("case:export", "Export Case Dossiers", "Permission to export case dossiers and evidence packages"),

    # Biometrics & Analytics
    ("photo_search:use", "Use Facial Recognition Search", "Permission to search database using 1:N biometric facial probes"),
    ("reports:read", "View Operational Reports", "Permission to access crime trend statistics and operational reports"),
    
    # Administration & Audit
    ("users:manage", "Manage System Users", "Permission to create, edit, and manage user clearances within jurisdiction"),
    ("audit_logs:read", "View Security Audit Logs", "Permission to view security audit trails and system access logs"),
    ("station:manage", "Manage Police Stations", "Permission to configure and manage police station jurisdictions"),
]

# Role mapping with precise permission codes
ROLE_DEFINITIONS = {
    "Administrator": {
        "id": "role-admin",
        "description": "Super Administrator with full global system administrative access across all jurisdictions",
        "permissions": [p[0] for p in SYSTEM_PERMISSIONS]
    },
    "State-level Administrator": {
        "id": "role-state-admin",
        "description": "State-wide administrative control across all districts and stations in the assigned state",
        "permissions": [
            "criminal:read", "criminal:update", "criminal:delete",
            "criminal:archive", "criminal:export", "criminal:view_sensitive",
            "case:create", "case:read", "case:update", "case:delete",
            "case:assign", "case:approve", "case:export",
            "photo_search:use", "reports:read", "users:manage", "audit_logs:read", "station:manage"
        ]
    },
    "Regional Administrator": {
        "id": "role-regional-admin",
        "description": "Regional administrative control across all districts and stations in the assigned region",
        "permissions": [
            "criminal:read", "criminal:update",
            "criminal:archive", "criminal:export", "criminal:view_sensitive",
            "case:create", "case:read", "case:update",
            "case:assign", "case:approve", "case:export",
            "photo_search:use", "reports:read", "users:manage", "audit_logs:read", "station:manage"
        ]
    },
    "District Administrator": {
        "id": "role-district-admin",
        "description": "District-wide administrative control across all stations in the assigned district",
        "permissions": [
            "criminal:read", "criminal:update",
            "criminal:archive", "criminal:export",
            "case:create", "case:read", "case:update",
            "case:assign", "case:approve", "case:export",
            "photo_search:use", "reports:read", "users:manage", "audit_logs:read"
        ]
    },
    "Station Administrator": {
        "id": "role-station-admin",
        "description": "Station-level operational management, case assignment, and officer supervision",
        "permissions": [
            "criminal:read", "criminal:update",
            "case:create", "case:read", "case:update",
            "case:assign", "case:approve",
            "photo_search:use", "reports:read", "users:manage"
        ]
    },
    "Officer": {
        "id": "role-officer",
        "description": "Investigating officer authorized to view dossiers and investigate assigned criminal cases",
        "permissions": [
            "criminal:read", "criminal:update",
            "case:create", "case:read", "case:update",
            "photo_search:use", "reports:read"
        ]
    },
    "Authorized Personnel": {
        "id": "role-authorized-personnel",
        "description": "Authorized support personnel with read-only operational record clearance",
        "permissions": [
            "criminal:read", "case:read", "reports:read"
        ]
    }
}


DEFAULT_STATIONS = [
    {
        "id": "station-metro-01",
        "station_code": "PS-METRO-01",
        "name": "Metro Central Precinct",
        "district": "Metro District",
        "state": "New York",
        "region": "Northeast Region",
        "address": "100 Centre St, New York, NY",
        "phone_number": "+1 212-555-0100"
    },
    {
        "id": "station-pudu-01",
        "station_code": "PS-PUDU-01",
        "name": "Puducherry Town Police Station",
        "district": "Puducherry District",
        "state": "Puducherry",
        "region": "Southern Region",
        "address": "Dumas St, White Town, Puducherry",
        "phone_number": "+91 413-222-4444"
    },
    {
        "id": "station-delhi-01",
        "station_code": "PS-DELHI-01",
        "name": "Connaught Place Police Station",
        "district": "New Delhi District",
        "state": "Delhi",
        "region": "Northern Region",
        "address": "Parliament St, Connaught Place, New Delhi",
        "phone_number": "+91 11-2334-5555"
    }
]

def apply_safe_schema_migrations(engine):
    """
    Safely inspects existing tables and applies ALTER TABLE statements for any missing columns.
    Idempotent and safe across SQLite and PostgreSQL.
    """
    with engine.connect() as conn:
        dialect = engine.dialect.name

        def get_existing_columns(table_name: str):
            if dialect == "sqlite":
                cols_raw = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
                return {c[1].lower() for c in cols_raw}
            else:
                cols_raw = conn.execute(
                    text("SELECT column_name FROM information_schema.columns WHERE table_name = :t"),
                    {"t": table_name}
                ).fetchall()
                return {c[0].lower() for c in cols_raw}

        # 1. users table
        try:
            user_cols = get_existing_columns("users")
            if "state" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN state VARCHAR(100);"))
            if "district" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN district VARCHAR(100);"))
            if "region" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN region VARCHAR(100);"))
            conn.commit()
        except Exception as e:
            logger.warning("Migration on users table: %s", e)

        # 2. police_stations table
        try:
            ps_cols = get_existing_columns("police_stations")
            if "region" not in ps_cols:
                conn.execute(text("ALTER TABLE police_stations ADD COLUMN region VARCHAR(100);"))
            conn.commit()
        except Exception as e:
            logger.warning("Migration on police_stations table: %s", e)

        # 3. criminals table
        try:
            crim_cols = get_existing_columns("criminals")
            if "police_station_id" not in crim_cols:
                conn.execute(text("ALTER TABLE criminals ADD COLUMN police_station_id VARCHAR(36);"))
            if "district" not in crim_cols:
                conn.execute(text("ALTER TABLE criminals ADD COLUMN district VARCHAR(100);"))
            if "region" not in crim_cols:
                conn.execute(text("ALTER TABLE criminals ADD COLUMN region VARCHAR(100);"))
            if "created_by_id" not in crim_cols:
                conn.execute(text("ALTER TABLE criminals ADD COLUMN created_by_id VARCHAR(36);"))
            conn.commit()
        except Exception as e:
            logger.warning("Migration on criminals table: %s", e)

        # 4. user_permission_grants table
        try:
            if dialect == "sqlite":
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_permission_grants (
                        id VARCHAR(36) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL,
                        permission_code VARCHAR(100) NOT NULL,
                        is_granted BOOLEAN NOT NULL DEFAULT 1,
                        granted_by_id VARCHAR(36),
                        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
                        revoked_by_id VARCHAR(36),
                        revoked_at TIMESTAMP,
                        reason TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        FOREIGN KEY (granted_by_id) REFERENCES users(id) ON DELETE SET NULL,
                        FOREIGN KEY (revoked_by_id) REFERENCES users(id) ON DELETE SET NULL
                    );
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_upg_user_id ON user_permission_grants(user_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_upg_perm_code ON user_permission_grants(permission_code);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_upg_is_granted ON user_permission_grants(is_granted);"))
            conn.commit()
        except Exception as e:
            logger.warning("Migration on user_permission_grants: %s", e)


def seed_rbac_data(db: Session):
    """
    Ensures all permissions, roles, and default police stations exist.
    Preserves legitimate existing user accounts (8829-JD, 7710-SO).
    """
    try:
        # 1. Seed Permissions
        perm_map = {}
        for code, name, desc in SYSTEM_PERMISSIONS:
            perm = db.query(PermissionModel).filter(PermissionModel.code == code).first()
            if not perm:
                perm = PermissionModel(
                    id=f"perm-{code}",
                    code=code,
                    name=name,
                    description=desc
                )
                db.add(perm)
                db.flush()
            perm_map[code] = perm

        # 2. Seed Roles and Associate Permissions
        for role_name, role_data in ROLE_DEFINITIONS.items():
            role = db.query(RoleModel).filter(RoleModel.name == role_name).first()
            if not role:
                role = RoleModel(
                    id=role_data["id"],
                    name=role_name,
                    description=role_data["description"]
                )
                db.add(role)
                db.flush()

            # Ensure role permissions match
            target_perms = [perm_map[c] for c in role_data["permissions"] if c in perm_map]
            role.permissions = target_perms

        # 3. Seed Default Police Stations
        for ps_data in DEFAULT_STATIONS:
            station = db.query(PoliceStationModel).filter(
                (PoliceStationModel.id == ps_data["id"]) | 
                (PoliceStationModel.station_code == ps_data["station_code"])
            ).first()
            if not station:
                station = PoliceStationModel(
                    id=ps_data["id"],
                    station_code=ps_data["station_code"],
                    name=ps_data["name"],
                    district=ps_data["district"],
                    state=ps_data["state"],
                    region=ps_data["region"],
                    address=ps_data["address"],
                    phone_number=ps_data["phone_number"],
                    is_active=True
                )
                db.add(station)
            else:
                station.region = ps_data["region"]
                station.district = ps_data["district"]
                station.state = ps_data["state"]

        db.flush()

        # 4. Attach stations to existing users if unassigned
        officer = db.query(UserModel).filter(UserModel.username == "7710-SO").first()
        if officer and not officer.police_station_id:
            officer.police_station_id = "station-metro-01"
            officer.district = "Metro District"
            officer.state = "New York"
            officer.region = "Northeast Region"

        # 5. Seed Default Crime Categories
        DEFAULT_CATEGORIES = [
            ("Theft", "CAT-THEFT", "Larceny, burglary, and property theft", "Medium"),
            ("Assault", "CAT-ASLT", "Violent physical altercation or battery", "High"),
            ("Fraud", "CAT-FRD", "White-collar, corporate, or financial deception", "Medium"),
            ("Narcotics", "CAT-NARC", "Controlled substances manufacturing or distribution", "High"),
            ("Fugitive", "CAT-FUG", "Escaped convicts or active flight from justice", "Critical"),
            ("Vehicle", "CAT-VEH", "Grand theft auto or vehicular manslaughter", "Medium"),
            ("Cybercrime", "CAT-CYBER", "Network breaches, ransomware, or identity theft", "High"),
            ("Financial", "CAT-FIN", "Money laundering, securities fraud, or embezzlement", "High"),
            ("Homicide", "CAT-HOM", "Unlawful killing of human beings", "Critical"),
        ]
        for c_name, c_code, c_desc, c_sev in DEFAULT_CATEGORIES:
            cat = db.query(CrimeCategoryModel).filter(
                (CrimeCategoryModel.name == c_name) | (CrimeCategoryModel.code == c_code)
            ).first()
            if not cat:
                cat = CrimeCategoryModel(
                    name=c_name,
                    code=c_code,
                    description=c_desc,
                    severity_level=c_sev
                )
                db.add(cat)

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error("Failed to seed RBAC data: %s", e)
        raise e

def run_db_migrations(engine, SessionFactory):
    apply_safe_schema_migrations(engine)
    db = SessionFactory()
    try:
        seed_rbac_data(db)
    finally:
        db.close()
