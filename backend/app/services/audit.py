from flask import request

from .. import db
from ..models.models import AuditLog


def write_audit(actor_user_id, subject_user_id, action, entity_type, entity_id, before=None, after=None):
    row = AuditLog(
        actor_user_id=actor_user_id,
        subject_user_id=subject_user_id or actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_json=before,
        after_json=after,
        ip_address=request.headers.get("X-Forwarded-For", request.remote_addr),
    )
    db.session.add(row)
    db.session.commit()
