from datetime import datetime

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .. import db
from ..models.models import MetalType, Transaction, TransactionType
from ..schemas.common import TransactionSchema
from ..services.audit import write_audit
from ..services.reconciliation import build_reconciliation_cases, rebuild_positions


transactions_bp = Blueprint("transactions", __name__)
transaction_schema = TransactionSchema()
transactions_schema = TransactionSchema(many=True)


@transactions_bp.get("")
@jwt_required()
def list_transactions():
    user_id = get_jwt_identity()
    txs = Transaction.query.filter_by(user_id=user_id, is_deleted=False).order_by(Transaction.transaction_date.desc()).all()
    return transactions_schema.dump(txs)


@transactions_bp.post("")
@jwt_required()
def create_transaction():
    user_id = get_jwt_identity()
    data = request.get_json()
    tx = Transaction(
        user_id=user_id,
        transaction_date=datetime.strptime(data["transaction_date"], "%Y-%m-%d").date(),
        type=TransactionType(data["type"]),
        metal=MetalType(data["metal"]),
        quantity_grams=data["quantity_grams"],
        ratio=data.get("ratio"),
        notes=data.get("notes"),
        ambiguous=data["type"] in {"switch_in", "sale"},
    )
    db.session.add(tx)
    db.session.commit()
    build_reconciliation_cases(user_id)
    rebuild_positions(user_id)
    write_audit(user_id, user_id, "transaction_created", "transaction", tx.id, after=transaction_schema.dump(tx))
    return transaction_schema.dump(tx), 201


@transactions_bp.put("/<transaction_id>")
@jwt_required()
def update_transaction(transaction_id):
    user_id = get_jwt_identity()
    tx = Transaction.query.filter_by(id=transaction_id, user_id=user_id, is_deleted=False).first_or_404()
    before = transaction_schema.dump(tx)
    data = request.get_json()
    for field in ["notes", "ratio", "quantity_grams"]:
        if field in data:
            setattr(tx, field, data[field])
    if "transaction_date" in data:
        tx.transaction_date = datetime.strptime(data["transaction_date"], "%Y-%m-%d").date()
    if "type" in data:
        tx.type = TransactionType(data["type"])
    if "metal" in data:
        tx.metal = MetalType(data["metal"])
    tx.version += 1
    db.session.commit()
    build_reconciliation_cases(user_id)
    rebuild_positions(user_id)
    write_audit(user_id, user_id, "transaction_updated", "transaction", tx.id, before=before, after=transaction_schema.dump(tx))
    return transaction_schema.dump(tx)
