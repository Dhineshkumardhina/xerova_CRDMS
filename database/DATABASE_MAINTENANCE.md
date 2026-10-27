# Xerova CRDMS — Database Schema, Migration & Maintenance Runbook

## 1. Overview & Architecture

The Crime Record & Dossier Management System (CRDMS) database is designed to support high-assurance law enforcement operations with strict regional jurisdiction boundaries, biometric face templates, case audit trails, and document custody records.

- **Primary Development Database:** SQLite (`crms_dev.db`) running with Write-Ahead Logging (`WAL`) mode and engine-level foreign key enforcement (`PRAGMA foreign_keys = ON`).
- **Production Target Database:** PostgreSQL (`crms_db` / Amazon RDS / Supabase / Cloud SQL) or enterprise SQLite with hot WAL backups.
- **Migration Framework:** Alembic (located in `database/migrations/`).
- **ORM / Data Access Layer:** SQLAlchemy 2.0 with type-annotated mapped models (`Base = DeclarativeBase`).

---

## 2. Entity Relational Model & Integrity Rules

```
                      +-------------------+
                      |   roles (7)       |
                      +---------+---------+
                                |
                 +--------------+--------------+
                 |                             |
      +----------v---------+        +----------v---------+
      |  role_permissions  |        |    users (2+)      |
      +----------+---------+        +----+-------+-------+
                 |                       |       |
      +----------v---------+             |       |
      |   permissions (19) |             |       |
      +--------------------+             |       |
                                         |       |
               +-------------------------+       |
               |                                 |
+--------------v-------------+        +----------v-----------+
|    police_stations (3+)    |        |   refresh_tokens     |
+--------------+-------------+        +----------------------+
               |
         +-----+--------------------------------+
         |                                      |
+--------v-------------------+        +---------v------------+
|     cases (FIRs)           |        |      criminals       |
+----+--------+--------+-----+        +----+-------+-----+---+
     |        |        |                   |       |     |
     |        |        |       +-----------+       |     +----------+
     |        |        |       |                   |                |
+----v---+ +-v------+ +-v-----v--------+ +---------v----------+ +---v-----------------+
| case_  | | case_  | | criminal_cases | | identification_    | | criminal_photos     |
| docs   | | categ. | +----------------+ | marks              | +----------+----------+
+--------+ +--------+                    +--------------------+            |
                                                                +----------v----------+
                                                                | face_embeddings     |
                                                                +---------------------+
```

### Key Data Integrity Rules:
1. **Foreign Key Enforcement:** SQLite connections automatically execute `PRAGMA foreign_keys=ON;` on connection via SQLAlchemy engine events.
2. **Jurisdiction & Case Assignment Consistency:** An investigating officer assigned as `lead_officer_id` to a case must possess jurisdictional clearance matching the case's precinct/station.
3. **Soft-Deletion:** Critical law enforcement profiles and cases are never hard-deleted; `is_deleted=True` and `deleted_at=timestamp` preserve full historical integrity.
4. **Cascade Deletes:** Subordinate biometric records (`identification_marks`, `criminal_photos`, `face_embeddings`) cascade on criminal expungement.
5. **Set-Null References:** Dropping an officer account (`users`) nullifies `cases.lead_officer_id` (`ON DELETE SET NULL`) without destroying the case dossier.

---

## 3. Version-Controlled Migration History

All schema evolutions are forward-only and version-controlled under `database/migrations/versions/`:

| Revision ID | Description | Down Revision |
| :--- | :--- | :--- |
| `0001_initial_schema` | Baseline schema for all 20 core tables, primary keys, and initial indexes. | `None` |
| `0002_regional_rbac_integrity` | Regional RBAC columns (`state`, `district`, `region`), foreign keys, and composite indexes. | `0001_initial_schema` |

---

## 4. Migration Runbook

### A. Development Database (`crms_dev.db`)

1. **Verify Current Migration Status:**
   ```powershell
   C:\Python314\python.exe -m alembic current
   ```

2. **Stamp Baseline (for databases created before migration tracking):**
   ```powershell
   C:\Python314\python.exe -m alembic stamp 0001_initial_schema
   ```

3. **Apply Forward Migrations:**
   ```powershell
   C:\Python314\python.exe -m alembic upgrade head
   ```

4. **Rollback Safety Verification (Discretionary / Automated Test):**
   ```powershell
   C:\Python314\python.exe -m alembic downgrade 0001_initial_schema
   C:\Python314\python.exe -m alembic upgrade head
   ```

### B. Production Database (PostgreSQL / Dedicated Server)

> [!IMPORTANT]
> Never apply migrations to production without first verifying a hot backup and testing against a disposable replica.

1. **Set Production Database URL:**
   ```bash
   export DATABASE_URL="postgresql://user:password@db-host:5432/crms_db"
   ```

2. **Inspect Pending Migration Steps (Dry-Run / SQL Generation):**
   ```bash
   alembic upgrade head --sql
   ```

3. **Execute Production Upgrade:**
   ```bash
   alembic upgrade head
   ```

4. **Verify Application Head Revision:**
   ```bash
   alembic current
   ```

---

## 5. Backup & Disaster Recovery Procedures

### SQLite Backup Procedure (`crms_dev.db`)

**1. Create Online Consistent Hot Backup:**
```powershell
C:\Python314\python.exe -c "
import sqlite3, shutil, datetime
timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = f'crms_backup_{timestamp}.db'

# Use SQLite online backup API to guarantee zero read/write disruption
src = sqlite3.connect('crms_dev.db')
dst = sqlite3.connect(backup_file)
src.backup(dst)
dst.close()
src.close()
print(f'Online backup completed: {backup_file}')
"
```

**2. Verify Backup File Integrity:**
```powershell
C:\Python314\python.exe -c "
import sqlite3
conn = sqlite3.connect('crms_backup_<timestamp>.db')
c = conn.cursor()
c.execute('PRAGMA integrity_check;')
status = c.fetchone()[0]
print('Integrity Check:', status)
assert status == 'ok'
conn.close()
"
```

**3. Disaster Recovery Restoration:**
```powershell
# 1. Stop backend application service
# 2. Rename corrupted or damaged database
Move-Item crms_dev.db crms_dev_damaged.db
# 3. Restore verified backup
Copy-Item crms_backup_<timestamp>.db crms_dev.db
# 4. Restart backend application service
```

### PostgreSQL Backup Procedure (`crms_db`)

**1. Logical Dump:**
```bash
pg_dump -h localhost -U postgres -d crms_db -F c -b -v -f "crms_backup_$(date +%Y%m%d_%H%M%S).dump"
```

**2. Restoration:**
```bash
pg_restore -h localhost -U postgres -d crms_db -v -c "crms_backup_<timestamp>.dump"
```

---

## 6. Connection Pooling & Performance Tuning

Configured in [backend/app/db/session.py](file:///c:/PROJECTS/xerova%20softwares/CRDMS/backend/app/db/session.py):

- **Concurrency Mode:** WAL mode (`PRAGMA journal_mode=WAL`) enables concurrent non-blocking reads during active write transactions.
- **Connection Timeout:** 30 seconds (`timeout=30`) prevents lock errors under burst write load.
- **Pool Sizing:**
  - SQLite: `pool_size=5`, `max_overflow=10`
  - PostgreSQL: `pool_size=10`, `max_overflow=20`
- **Liveness Checking:** `pool_pre_ping=True` proactively detects and recycles disconnected pooled connections.
