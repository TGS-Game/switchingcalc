from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.audit import write_audit
from ..services.parser import create_upload


uploads_bp = Blueprint("uploads", __name__)


@uploads_bp.post("")
@jwt_required()
def upload_statement():
    user_id = get_jwt_identity()

    if "file" not in request.files:
        return {"error": "file_required"}, 400

    f = request.files["file"]
    if not f.filename.lower().endswith(".csv"):
        return {"error": "only_csv_supported_for_this_step"}, 400

    batch, suggestions, new_row_count, skipped_duplicate_count = create_upload(user_id, f.filename, "csv", f.read())

    write_audit(
        user_id,
        user_id,
        "upload_processed",
        "upload_batch",
        batch.id,
        after={
            "status": batch.status.value,
            "suggestion_count": len(suggestions),
            "new_row_count": new_row_count,
            "skipped_duplicate_count": skipped_duplicate_count,
        },
    )

    return {
        "upload_batch_id": str(batch.id),
        "status": batch.status.value,
        "suggestion_count": len(suggestions),
        "new_row_count": new_row_count,
        "skipped_duplicate_count": skipped_duplicate_count,
        "message": "Upload complete. Only new rows were processed. Review the suggested transactions before they affect holdings."
    }, 201
