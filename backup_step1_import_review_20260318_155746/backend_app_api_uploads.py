from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.audit import write_audit
from ..services.parser import create_upload
from ..services.reconciliation import build_reconciliation_cases, rebuild_positions


uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.post("")
@jwt_required()
def upload_statement():
    user_id = get_jwt_identity()
    f = request.files["file"]
    ext = f.filename.split(".")[-1].lower()
    if ext not in {"csv", "pdf"}:
        return {"error": "unsupported_file_type"}, 400
    batch = create_upload(user_id, f.filename, ext, f.read())
    cases = build_reconciliation_cases(user_id)
    rebuild_positions(user_id)
    write_audit(user_id, user_id, "upload_processed", "upload_batch", batch.id, after={"status": batch.status.value})
    return {
        "upload_batch_id": str(batch.id),
        "status": batch.status.value,
        "reconciliation_case_count": len(cases),
    }, 201
