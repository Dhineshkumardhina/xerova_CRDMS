import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.core.security import get_password_hash
from app.models.user import UserModel
from app.models.role_permission import RoleModel, PermissionModel
from app.models.police_station import PoliceStationModel
from app.models.criminal import CriminalProfileModel
from app.models.refresh_token import RefreshTokenModel
from app.models.audit_log import AuditLogModel

def seed_users():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Seed Permissions
        perm_codes = [
            ("criminal:create", "Create Criminal Dossiers"),
            ("criminal:read", "View Criminal Dossiers"),
            ("criminal:update", "Update Criminal Dossiers"),
            ("criminal:archive", "Archive Criminal Dossiers"),
            ("case:create", "Create Cases"),
            ("case:read", "View Cases"),
            ("case:update", "Update Cases"),
            ("photo_search:use", "Use Facial Recognition Search"),
            ("reports:read", "View Operational Reports"),
            ("users:manage", "Manage System Users"),
            ("audit_logs:read", "View Security Audit Logs"),
        ]
        
        perm_objs = []
        for code, name in perm_codes:
            p = db.query(PermissionModel).filter(PermissionModel.code == code).first()
            if not p:
                p = PermissionModel(id=f"perm-{code}", code=code, name=name)
                db.add(p)
            perm_objs.append(p)
        db.commit()

        # 2. Seed Roles
        admin_role = db.query(RoleModel).filter(RoleModel.name == "Administrator").first()
        if not admin_role:
            admin_role = RoleModel(id="role-admin", name="Administrator", description="Full Access")
            admin_role.permissions = perm_objs
            db.add(admin_role)

        officer_role = db.query(RoleModel).filter(RoleModel.name == "Officer").first()
        if not officer_role:
            officer_role = RoleModel(id="role-officer", name="Officer", description="Operational Officer Access")
            officer_role.permissions = [p for p in perm_objs if p.code in {"criminal:read", "case:read", "photo_search:use", "reports:read"}]
            db.add(officer_role)
        db.commit()

        # 3. Seed Administrator User (8829-JD)
        admin_user = db.query(UserModel).filter(UserModel.username == "8829-JD").first()
        if not admin_user:
            admin_user = UserModel(
                id="usr-admin-01",
                username="8829-JD",
                hashed_password=get_password_hash("DeptJusticeSecure#2024"),
                full_name="Officer J. Daniels",
                badge_number="8829-JD",
                rank="Senior Inspector",
                department="Justice Department",
                clearance_level="Level 5 - Top Secret",
                is_superuser=True,
                is_active=True,
                role_id=admin_role.id
            )
            db.add(admin_user)
        else:
            admin_user.hashed_password = get_password_hash("DeptJusticeSecure#2024")
            admin_user.is_active = True
            admin_user.badge_number = "8829-JD"

        # 4. Seed Officer User (7710-SO)
        officer_user = db.query(UserModel).filter(UserModel.username == "7710-SO").first()
        if not officer_user:
            officer_user = UserModel(
                id="usr-officer-01",
                username="7710-SO",
                hashed_password=get_password_hash("OfficerSecure#2024"),
                full_name="Officer Sam Operational",
                badge_number="7710-SO",
                rank="Patrol Officer",
                department="Metro Precinct",
                clearance_level="Level 2 - Confidential",
                is_superuser=False,
                is_active=True,
                role_id=officer_role.id
            )
            db.add(officer_user)
        else:
            officer_user.hashed_password = get_password_hash("OfficerSecure#2024")
            officer_user.is_active = True
            officer_user.badge_number = "7710-SO"

        # 5. Seed Sample Criminal Profile if missing
        sample_crim = db.query(CriminalProfileModel).filter(CriminalProfileModel.id == "CR-001245").first()
        if not sample_crim:
            sample_crim = CriminalProfileModel(
                id="CR-001245",
                name="Raj Kumar Sharma",
                normalized_name="raj kumar sharma",
                alias="Raj",
                father_name="Suresh Kumar Sharma",
                age=34,
                gender="Male",
                phone_number="+1 555-019-2831",
                identification_number="XXXX-XXXX-9900",
                primary_address="12 MG Road",
                city="Puducherry",
                state="Puducherry",
                category="Theft",
                status="Active",
                is_archived=False,
                is_deleted=False
            )
            db.add(sample_crim)

        db.commit()
        print("Successfully seeded users 8829-JD and 7710-SO into crms_dev.db!")
    except Exception as e:
        db.rollback()
        print("Error seeding database users:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()
