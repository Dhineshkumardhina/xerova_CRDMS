from app.db.session import Base
from app.models.role_permission import RoleModel, PermissionModel, RolePermissionModel
from app.models.police_station import PoliceStationModel
from app.models.user import UserModel
from app.models.refresh_token import RefreshTokenModel
from app.models.criminal import (
    CriminalProfileModel,
    CriminalAliasModel,
    IdentificationMarkModel,
    CriminalPhotoModel,
)
from app.models.biometrics import FaceEmbeddingModel
from app.models.case import (
    CrimeCategoryModel,
    CaseCategoryModel,
    CriminalCaseModel,
    CaseRecordModel,
)
from app.models.document import (
    DocumentItemModel,
    CriminalDocumentModel,
    CaseDocumentModel,
)
from app.models.audit_log import AuditLogModel, SearchMetadataModel
from app.models.token_blacklist import RevokedTokenModel
