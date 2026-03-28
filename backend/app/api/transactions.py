from datetime import datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .. import db
from ..models.models import MetalType, Transaction, TransactionType
from ..schemas.common import TransactionSchema
from ..services.audit import write_audit


transactions_bp = Blueprint("transactions", __name__)
transaction_schema = TransactionSchema()
transactions_schema = TransactionSchema(many=True)


def _parse_decimal(value):
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _metal_or_none(value):
    if not value:
        return None
    return MetalType(str(value).lower())


@transactions_bp.get("")
@jwt_required()
def list_transactions():
    user_id = get_jwt_identity()
    txs = Transaction.query.filter_by(user_id=user_id, is_deleted=False).order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).all()
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
        metal=_metal_or_none(data.get("metal")),
        from_metal=_metal_or_none(data.get("from_metal")),
        to_metal=_metal_or_none(data.get("to_metal")),
        quantity_grams=_parse_decimal(data.get("quantity_grams")),
        to_quantity_grams=_parse_decimal(data.get("to_quantity_grams")),
        ratio=_parse_decimal(data.get("ratio")),
        notes=data.get("notes"),
        ambiguous=False,
    )
    db.session.add(tx)
    db.session.commit()
    write_audit(user_id, user_id, "transaction_created", "transaction", tx.id, after=transaction_schema.dump(tx))
    return transaction_schema.dump(tx), 201


@transactions_bp.put("/<transaction_id>")
@jwt_required()
def update_transaction(transaction_id):
    user_id = get_jwt_identity()
    tx = Transaction.query.filter_by(id=transaction_id, user_id=user_id, is_deleted=False).first_or_404()
    before = transaction_schema.dump(tx)
    data = request.get_json()

    for field in ["notes"]:
        if field in data:
            setattr(tx, field, data[field])

    for field in ["ratio", "quantity_grams", "to_quantity_grams"]:
        if field in data:
            setattr(tx, field, _parse_decimal(data[field]))

    if "transaction_date" in data:
        tx.transaction_date = datetime.strptime(data["transaction_date"], "%Y-%m-%d").date()
    if "type" in data:
        tx.type = TransactionType(data["type"])
    if "metal" in data:
        tx.metal = _metal_or_none(data["metal"])
    if "from_metal" in data:
        tx.from_metal = _metal_or_none(data["from_metal"])
    if "to_metal" in data:
        tx.to_metal = _metal_or_none(data["to_metal"])

    tx.version += 1
    db.session.commit()
    write_audit(user_id, user_id, "transaction_updated", "transaction", tx.id, before=before, after=transaction_schema.dump(tx))
    return transaction_schema.dump(tx)
