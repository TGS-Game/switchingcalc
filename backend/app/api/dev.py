from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models.models import (
    AlertRule,
    AuditLog,
    DataSnapshot,
    LotAllocation,
    Notification,
    PositionLot,
    RawStatementRow,
    ReconciliationCase,
    SavedCalculationScenario,
    SuggestedTransaction,
    Transaction,
    UploadBatch,
    User,
)
from ..services.snapshots import create_data_snapshot

dev_bp = Blueprint("dev", __name__, url_prefix="/dev")


@dev_bp.route("/reset-data", methods=["POST"])
@jwt_required()
def reset_data():
    user_id = get_jwt_identity()

    snapshot = create_data_snapshot(
        user_id=user_id,
        reason="pre_reset_data",
        actor_user_id=user_id,
        extra_meta={"source": "dev_reset_data"},
    )

    batches = UploadBatch.query.filter_by(user_id=user_id).all()
    batch_ids = [b.id for b in batches]

    transactions = Transaction.query.filter_by(user_id=user_id).all()
    transaction_ids = [t.id for t in transactions]

    lots = PositionLot.query.filter_by(user_id=user_id).all()
    lot_ids = [l.id for l in lots]

    if lot_ids:
        LotAllocation.query.filter(LotAllocation.source_lot_id.in_(lot_ids)).delete(synchronize_session=False)

    if transaction_ids:
        LotAllocation.query.filter(LotAllocation.target_transaction_id.in_(transaction_ids)).delete(synchronize_session=False)
        ReconciliationCase.query.filter(ReconciliationCase.transaction_id.in_(transaction_ids)).delete(synchronize_session=False)

    PositionLot.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    ReconciliationCase.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Transaction.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    SuggestedTransaction.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    SavedCalculationScenario.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    AlertRule.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    Notification.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    DataSnapshot.query.filter(DataSnapshot.user_id == user_id, DataSnapshot.id != snapshot.id).delete(synchronize_session=False)

    AuditLog.query.filter_by(actor_user_id=user_id).delete(synchronize_session=False)
    AuditLog.query.filter_by(subject_user_id=user_id).delete(synchronize_session=False)

    if batch_ids:
        RawStatementRow.query.filter(RawStatementRow.upload_batch_id.in_(batch_ids)).delete(synchronize_session=False)

    UploadBatch.query.filter_by(user_id=user_id).delete(synchronize_session=False)

    db.session.commit()

    return jsonify({
        "status": "ok",
        "snapshot_id": str(snapshot.id),
        "snapshot_reason": snapshot.reason,
    })
@dev_bp.route("/promote-user", methods=["POST"])
def promote_user():
    from flask import request

    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    role = (data.get("role") or "admin").strip().lower()

    if not email:
        return jsonify({"error": "email is required"}), 400

    if role not in {"user", "admin"}:
        return jsonify({"error": "role must be user or admin"}), 400

    user = User.query.filter(db.func.lower(User.email) == email).first()
    if not user:
        return jsonify({"error": "user not found"}), 404

    previous_role = user.role.value
    if previous_role == role:
        return jsonify({
            "status": "ok",
            "patched": False,
            "email": user.email,
            "role": user.role.value,
        })

    user.role = role
    db.session.commit()

    return jsonify({
        "status": "ok",
        "patched": True,
        "email": user.email,
        "previous_role": previous_role,
        "role": user.role.value,
    })