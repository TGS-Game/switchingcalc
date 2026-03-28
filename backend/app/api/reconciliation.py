from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..services.audit import write_audit
from ..services.reconciliation import (
    apply_review_action,
    list_pending_allocation_items,
    list_review_items,
    resolve_allocation_case,
)


reconciliation_bp = Blueprint("reconciliation", __name__)


@reconciliation_bp.get("")
@jwt_required()
def list_cases():
    user_id = get_jwt_identity()
    status = request.args.get("status", "pending")
    return list_review_items(user_id, status=status)


@reconciliation_bp.get("/pending-allocations")
@jwt_required()
def pending_allocations():
    user_id = get_jwt_identity()
    kind = request.args.get("kind", "switch")
    return list_pending_allocation_items(user_id, kind)


@reconciliation_bp.post("/cases/<transaction_id>/resolve-allocations")
@jwt_required()
def resolve_allocations(transaction_id):
    user_id = get_jwt_identity()
    payload = request.get_json() or {}
    try:
        result = resolve_allocation_case(user_id, transaction_id, payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    write_audit(
        user_id,
        user_id,
        "allocation_case_resolved",
        "transaction",
        transaction_id,
        after=result,
    )
    return result


@reconciliation_bp.post("/<suggestion_id>/resolve")
@jwt_required()
def resolve(suggestion_id):
    user_id = get_jwt_identity()
    payload = request.get_json() or {}
    try:
        result = apply_review_action(user_id, suggestion_id, payload)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    write_audit(
        user_id,
        user_id,
        "suggestion_reviewed",
        "suggested_transaction",
        suggestion_id,
        after=result,
    )
    return result


@reconciliation_bp.post("/bulk-resolve")
@jwt_required()
def bulk_resolve():
    user_id = get_jwt_identity()
    payload = request.get_json() or {}
    items = payload.get("items", [])

    results = []
    errors = []

    for item in items:
        suggestion_id = item.get("suggestion_id")
        if not suggestion_id:
            continue

        try:
            result = apply_review_action(user_id, suggestion_id, item)
            write_audit(
                user_id,
                user_id,
                "suggestion_reviewed_bulk",
                "suggested_transaction",
                suggestion_id,
                after=result,
            )
            results.append(result)
        except Exception as exc:
            errors.append({
                "id": suggestion_id,
                "error": str(exc),
            })

    return {
        "processed_count": len(results),
        "error_count": len(errors),
        "results": results,
        "errors": errors,
    }

