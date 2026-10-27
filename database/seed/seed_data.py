"""
Development Database Seeding Script for CRMS
Populates initial roles, permissions, police station, crime categories, officer user, sample criminal dossiers, and biometric face embeddings.
"""

import sys
import os
import uuid

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from sqlalchemy.orm import Session
from app.db.session import engine, SessionLocal, Base
from app.db.base import (
    RoleModel,
    PermissionModel,
    RolePermissionModel,
    PoliceStationModel,
    UserModel,
    CrimeCategoryModel,
    CriminalProfileModel,
    CriminalAliasModel,
    IdentificationMarkModel,
    CriminalPhotoModel,
    FaceEmbeddingModel,
    CaseRecordModel,
    CaseCategoryModel,
    CriminalCaseModel,
    AuditLogModel,
)
from app.core.security import get_password_hash
from app.services.face_recognition import extract_face_embedding

def seed_database():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # 1. Seed Permissions
        permissions_def = [
            ("criminal:create", "Create Criminal Profile", "Ability to create new criminal dossiers"),
            ("criminal:read", "Read Criminal Profile", "Ability to view criminal dossiers and search records"),
            ("criminal:update", "Update Criminal Profile", "Ability to edit criminal profiles and upload evidence"),
            ("criminal:archive", "Archive Criminal Profile", "Ability to toggle profile archive status"),
            ("case:create", "Create Case Docket", "Ability to file new FIR cases"),
            ("case:read", "Read Cases", "Ability to view FIR dockets and case records"),
            ("case:update", "Update Cases", "Ability to update case status and notes"),
            ("photo_search:use", "Biometric Photo Search", "Ability to execute facial recognition search"),
            ("reports:read", "Read Analytical Reports", "Ability to view crime analytics and trend charts"),
            ("users:manage", "Manage Officer Users", "Ability to view, create, and manage officer user accounts"),
            ("audit_logs:read", "Read System Audit Logs", "Ability to inspect security audit trail logs"),
        ]

        perm_map = {}
        for code, name, desc in permissions_def:
            p_obj = db.query(PermissionModel).filter(PermissionModel.code == code).first()
            if not p_obj:
                p_obj = PermissionModel(
                    id=str(uuid.uuid4()),
                    code=code,
                    name=name,
                    description=desc
                )
                db.add(p_obj)
                db.flush()
            perm_map[code] = p_obj
        print("Permissions created.")

        # 2. Seed Roles
        admin_role = db.query(RoleModel).filter(RoleModel.name == "Admin").first()
        if not admin_role:
            admin_role = RoleModel(
                id=str(uuid.uuid4()),
                name="Admin",
                description="System Administrator with full security access"
            )
            db.add(admin_role)
            db.flush()

        officer_role = db.query(RoleModel).filter(RoleModel.name == "Officer").first()
        if not officer_role:
            officer_role = RoleModel(
                id=str(uuid.uuid4()),
                name="Officer",
                description="Authorized Law Enforcement Officer"
            )
            db.add(officer_role)
            db.flush()
        print("Roles created.")

        # Assign all permissions to Admin
        for p_code, p_obj in perm_map.items():
            link = db.query(RolePermissionModel).filter(
                RolePermissionModel.role_id == admin_role.id,
                RolePermissionModel.permission_id == p_obj.id
            ).first()
            if not link:
                db.add(RolePermissionModel(role_id=admin_role.id, permission_id=p_obj.id))

        # Assign operational permissions to Officer (criminal record creation is disabled by default)
        officer_perms = ["criminal:read", "criminal:update", "case:read", "case:create", "case:update", "photo_search:use", "reports:read"]
        for p_code in officer_perms:
            p_obj = perm_map[p_code]
            link = db.query(RolePermissionModel).filter(
                RolePermissionModel.role_id == officer_role.id,
                RolePermissionModel.permission_id == p_obj.id
            ).first()
            if not link:
                db.add(RolePermissionModel(role_id=officer_role.id, permission_id=p_obj.id))
        db.flush()

        # 3. Seed Police Station
        station = db.query(PoliceStationModel).filter(PoliceStationModel.station_code == "PS-NYC-04").first()
        if not station:
            station = PoliceStationModel(
                id=str(uuid.uuid4()),
                station_code="PS-NYC-04",
                name="4th Precinct Headquarters",
                district="Metro Central District",
                state="NY",
                address="100 Justice Plaza, Metro City",
                phone_number="+1 555-019-8829",
                is_active=True
            )
            db.add(station)
            db.flush()
            print("Police station created.")

        # 4. Seed Administrator User (8829-JD)
        admin_user = db.query(UserModel).filter(UserModel.username == "8829-JD").first()
        if not admin_user:
            admin_user = UserModel(
                id=str(uuid.uuid4()),
                username="8829-JD",
                email="officer.daniels@doj.gov",
                hashed_password=get_password_hash("DeptJusticeSecure#2024"),
                full_name="Officer J. Daniels",
                badge_number="8829-JD",
                rank="Senior Detective",
                department="Homicide & Major Crimes Division",
                clearance_level="Level 4 - Top Secret",
                avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
                role_id=admin_role.id,
                police_station_id=station.id,
                is_active=True,
                is_superuser=True
            )
            db.add(admin_user)
            db.flush()
            print("Administrator user created.")

        # 5. Seed Standard Officer User (7710-SO)
        officer_user = db.query(UserModel).filter(UserModel.username == "7710-SO").first()
        if not officer_user:
            officer_user = UserModel(
                id=str(uuid.uuid4()),
                username="7710-SO",
                email="officer.smith@doj.gov",
                hashed_password=get_password_hash("OfficerSecure#2024"),
                full_name="Detective S. Owens",
                badge_number="7710-SO",
                rank="Field Detective",
                department="Patrol & Incident Response",
                clearance_level="Level 2 - Confidential",
                avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256",
                role_id=officer_role.id,
                police_station_id=station.id,
                is_active=True,
                is_superuser=False
            )
            db.add(officer_user)
            db.flush()
            print("Standard officer user created.")

        # 6. Seed Crime Categories
        categories_data = [
          {"name": "Theft", "code": "CAT-THEFT", "severity": "Medium", "desc": "Larceny, shoplifting, burglary, and property theft offenses."},
          {"name": "Assault", "code": "CAT-ASSAULT", "severity": "High", "desc": "Physical violence, battery, and aggravated assault cases."},
          {"name": "Fraud", "code": "CAT-FRAUD", "severity": "Medium", "desc": "Financial deception, identity theft, wire fraud, and embezzlement."},
          {"name": "Narcotics", "code": "CAT-NARCO", "severity": "High", "desc": "Possession, distribution, trafficking, and manufacturing of illegal substances."},
          {"name": "Fugitive", "code": "CAT-FUGITIVE", "severity": "Critical", "desc": "Subjects actively evading law enforcement with active arrest warrants."},
          {"name": "Vehicle", "code": "CAT-VEHICLE", "severity": "Low", "desc": "Grand theft auto, reckless driving, and vehicular infractions."},
          {"name": "Cybercrime", "code": "CAT-CYBER", "severity": "High", "desc": "Ransomware, unauthorized access, data breach, and telecommunications fraud."},
          {"name": "Financial", "code": "CAT-FIN", "severity": "Medium", "desc": "Money laundering, tax evasion, securities manipulation, and bribery."},
          {"name": "Homicide", "code": "CAT-HOM", "severity": "Critical", "desc": "First and second-degree murder, manslaughter, and violent fatal offenses."},
          {"name": "House Breaking", "code": "CAT-HB", "severity": "Medium", "desc": "Unlawful entry into residential or commercial property with intent to commit felony."}
        ]

        cat_map = {}
        for cdata in categories_data:
            cat_obj = db.query(CrimeCategoryModel).filter(CrimeCategoryModel.code == cdata["code"]).first()
            if not cat_obj:
                cat_obj = CrimeCategoryModel(
                    id=str(uuid.uuid4()),
                    name=cdata["name"],
                    code=cdata["code"],
                    description=cdata["desc"],
                    severity_level=cdata["severity"]
                )
                db.add(cat_obj)
                db.flush()
            cat_map[cdata["name"]] = cat_obj
        print("Crime categories seeded.")


        db.commit()
        print("Database seed script executed successfully (roles, permissions, stations, users, categories).")
    except Exception as e:
        db.rollback()
        print(f"Database seed failed: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
