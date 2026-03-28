from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..models.models import ReconciliationCase
from ..schemas.common import ReconciliationCaseSchema
from ..services.reconciliation import build_reconciliation_cases, resolve_case
from ..services.audit import write_audit


reconciliation_bp = Blueprint("reconciliation", __name__)
case_schema = ReconciliationCaseSchema()
case_list_schema = ReconciliationCaseSchema(many=True)


@reconciliation_bp.get("")
@jwt_required()
def list_cases():
    user_id = get_jwt_identity()
    build_reconciliation_cases(user_id)
    cases = ReconciliationCase.query.filter_by(user_id=user_id).order_by(ReconciliationCase.created_at.desc()).all()
    return case_list_schema.dump(cases)


@reconciliation_bp.post("/<case_id>/resolve")
@jwt_required()
def resolve(case_id):
    user_id = get_jwt_identity()
    case = ReconciliationCase.query.filter_by(id=case_id, user_id=user_id).first_or_404()
    allocations = request.get_json()["allocations"]
    resolved = resolve_case(case, allocations)
    write_audit(user_id, user_id, "reconciliation_resolved", "reconciliation_case", case.id, after={"allocations": allocations})
    return case_schema.dump(resolved)
