from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .. import db
from ..models.models import DataSnapshot, User
from ..services.audit import write_audit
from ..services.auth import hash_password, verify_password
from ..services.snapshots import create_data_snapshot, list_data_snapshots, restore_data_snapshot


account_bp = Blueprint("account", __name__)


def _current_user():
    user_id = get_jwt_identity()
    return User.query.filter_by(id=user_id, deleted_at=None).first_or_404()


@account_bp.get("/profile")
@jwt_required()
def get_profile():
    user = _current_user()
    return jsonify({
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role.value,
    })


@account_bp.patch("/profile")
@jwt_required()
def update_profile():
    user = _current_user()
    payload = request.get_json() or {}

    next_email = str(payload.get("email") or "").strip().lower()
    if not next_email:
        return jsonify({"error": "email is required"}), 400

    existing = User.query.filter(
        db.func.lower(User.email) == next_email,
        User.id != user.id,
        User.deleted_at.is_(None),
    ).first()

    if existing:
        return jsonify({"error": "email is already in use"}), 400

    before = {"email": user.email}
    user.email = next_email
    db.session.commit()

    write_audit(
        actor_user_id=user.id,
        subject_user_id=user.id,
        action="customer_update_profile",
        entity_type="user",
        entity_id=user.id,
        before=before,
        after={"email": user.email},
    )

    return jsonify({
        "status": "ok",
        "user_id": str(user.id),
        "email": user.email,
    })


@account_bp.post("/change-password")
@jwt_required()
def change_password():
    user = _current_user()
    payload = request.get_json() or {}

    current_password = str(payload.get("current_password") or "")
    new_password = str(payload.get("new_password") or "")
    confirm_password = str(payload.get("confirm_password") or "")

    if not current_password:
        return jsonify({"error": "current_password is required"}), 400

    if not verify_password(current_password, user.password_hash):
        return jsonify({"error": "current password is incorrect"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "new password must be at least 8 characters"}), 400

    if new_password != confirm_password:
        return jsonify({"error": "new password and confirm password must match"}), 400

    user.password_hash = hash_password(new_password)
    db.session.commit()

    write_audit(
        actor_user_id=user.id,
        subject_user_id=user.id,
        action="customer_change_password",
        entity_type="user",
        entity_id=user.id,
        after={"password_changed": True},
    )

    return jsonify({"status": "ok"})


@account_bp.get("/snapshots")
@jwt_required()
def get_snapshots():
    user = _current_user()
    items = list_data_snapshots(user.id)
    return jsonify({"items": items})


@account_bp.post("/snapshots")
@jwt_required()
def create_snapshot():
    user = _current_user()
    payload = request.get_json() or {}

    reason = str(payload.get("reason") or "customer_manual_snapshot").strip()
    if not reason:
        reason = "customer_manual_snapshot"

    snapshot = create_data_snapshot(
        user_id=user.id,
        reason=reason,
        actor_user_id=user.id,
        extra_meta={"source": "customer_settings"},
    )

    write_audit(
        actor_user_id=user.id,
        subject_user_id=user.id,
        action="customer_create_snapshot",
        entity_type="data_snapshot",
        entity_id=snapshot.id,
        after={"reason": snapshot.reason},
    )

    return jsonify({
        "status": "ok",
        "id": str(snapshot.id),
        "reason": snapshot.reason,
        "created_at": snapshot.created_at.isoformat() if snapshot.created_at else None,
    }), 201


@account_bp.post("/snapshots/<snapshot_id>/restore")
@jwt_required()
def restore_snapshot(snapshot_id):
    user = _current_user()

    snapshot = DataSnapshot.query.filter_by(id=snapshot_id, user_id=user.id).first()
    if not snapshot:
        return jsonify({"error": "snapshot not found"}), 404

    backup_snapshot = create_data_snapshot(
        user_id=user.id,
        reason="pre_restore_backup_customer",
        actor_user_id=user.id,
        extra_meta={"requested_snapshot_id": str(snapshot.id)},
    )

    result = restore_data_snapshot(snapshot.id, actor_user_id=user.id)
    result["pre_restore_backup_snapshot_id"] = str(backup_snapshot.id)

    write_audit(
        actor_user_id=user.id,
        subject_user_id=user.id,
        action="customer_restore_snapshot",
        entity_type="data_snapshot",
        entity_id=snapshot.id,
        after=result,
    )

    return jsonify(result)