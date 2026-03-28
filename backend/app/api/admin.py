from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..models.models import User
from ..services.audit import write_audit
from ..services.snapshots import create_data_snapshot, list_data_snapshots, restore_data_snapshot


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

    write_audit(
        actor,
        None,
        "admin_list_users",
        "user",
        "*",
        after={"count": len(users)},
    )

    return [{"id": str(u.id), "email": u.email, "role": u.role.value} for u in users]


@admin_bp.get("/users/<user_id>/snapshots")
@jwt_required()
def admin_list_snapshots(user_id):
    if not require_admin():
        return {"error": "forbidden"}, 403

    actor = get_jwt_identity()
    snapshots = list_data_snapshots(user_id)

    write_audit(
        actor,
        user_id,
        "admin_list_snapshots",
        "data_snapshot",
        user_id,
        after={"count": len(snapshots)},
    )

    return jsonify({"items": snapshots})


@admin_bp.post("/users/<user_id>/snapshots")
@jwt_required()
def admin_create_snapshot(user_id):
    if not require_admin():
        return {"error": "forbidden"}, 403

    actor = get_jwt_identity()
    payload = request.get_json() or {}
    reason = payload.get("reason") or "admin_manual_snapshot"
    extra = payload.get("extra") or {}

    snapshot = create_data_snapshot(
        user_id=user_id,
        reason=reason,
        actor_user_id=actor,
        extra_meta=extra,
    )

    write_audit(
        actor,
        user_id,
        "admin_create_snapshot",
        "data_snapshot",
        snapshot.id,
        after={"reason": reason},
    )

    return jsonify({
        "id": str(snapshot.id),
        "user_id": str(snapshot.user_id),
        "reason": snapshot.reason,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
    }), 201


@admin_bp.post("/snapshots/<snapshot_id>/restore")
@jwt_required()
def admin_restore_snapshot(snapshot_id):
    if not require_admin():
        return {"error": "forbidden"}, 403

    actor = get_jwt_identity()
    payload = request.get_json() or {}
    user_id = payload.get("user_id")

    if not user_id:
        return {"error": "user_id is required"}, 400

    backup_snapshot = create_data_snapshot(
        user_id=user_id,
        reason="pre_restore_backup",
        actor_user_id=actor,
        extra_meta={"requested_snapshot_id": snapshot_id},
    )

    result = restore_data_snapshot(snapshot_id, actor_user_id=actor)
    result["pre_restore_backup_snapshot_id"] = str(backup_snapshot.id)

    write_audit(
        actor,
        result.get("user_id"),
        "admin_restore_snapshot",
        "data_snapshot",
        snapshot_id,
        after=result,
    )

    return jsonify(result)