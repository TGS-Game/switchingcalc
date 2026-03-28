from flask import Blueprint
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..models.models import User
from ..services.audit import write_audit


admin_bp = Blueprint("admin", __name__)


def require_admin():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return False
    return True


@admin_bp.get("/users")
@jwt_required()
def list_users():
    if not require_admin():
        return {"error": "forbidden"}, 403
    actor = get_jwt_identity()
    users = User.query.filter_by(deleted_at=None).all()
    write_audit(actor, None, "admin_list_users", "user", "*", after={"count": len(users)})
    return [{"id": str(u.id), "email": u.email, "role": u.role.value} for u in users]
