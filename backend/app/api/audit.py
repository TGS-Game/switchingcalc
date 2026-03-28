from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models.models import AuditLog


audit_bp = Blueprint("audit", __name__)


@audit_bp.get("")
@jwt_required()
def list_audit():
    user_id = get_jwt_identity()
    rows = AuditLog.query.filter_by(subject_user_id=user_id).order_by(AuditLog.created_at.desc()).limit(200).all()
    return [
        {
            "id": str(r.id),
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
