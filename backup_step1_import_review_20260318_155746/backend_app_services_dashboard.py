from sqlalchemy import func

from ..models.models import MetalType, PositionLot, Transaction, TransactionType


def holdings_summary(user_id):
    gold = (
        PositionLot.query.with_entities(func.coalesce(func.sum(PositionLot.remaining_quantity_grams), 0))
        .filter_by(user_id=user_id, current_metal=MetalType.gold, closed_on=None)
        .scalar()
    )
    silver = (
        PositionLot.query.with_entities(func.coalesce(func.sum(PositionLot.remaining_quantity_grams), 0))
        .filter_by(user_id=user_id, current_metal=MetalType.silver, closed_on=None)
        .scalar()
    )
    switches = Transaction.query.filter_by(user_id=user_id, type=TransactionType.switch_in).count()
    fees = (
        Transaction.query.with_entities(func.coalesce(func.sum(Transaction.quantity_grams), 0))
        .filter_by(user_id=user_id, type=TransactionType.storage_fee)
        .scalar()
    )
    return {
        "gold_grams": float(gold or 0),
        "silver_grams": float(silver or 0),
        "switch_count": switches,
        "storage_fee_grams": float(fees or 0),
    }


def calculator(user_id, target_ratio):
    current = holdings_summary(user_id)
    gold = current["gold_grams"]
    silver = current["silver_grams"]
    if target_ratio <= 0:
        return {"error": "target_ratio_must_be_positive"}
    silver_as_gold = silver / target_ratio
    total_gold_equivalent = gold + silver_as_gold
    fee_drag_pct = (current["storage_fee_grams"] / max(gold + silver, 0.000001)) * 100
    return {
        "target_ratio": target_ratio,
        "gold_equivalent_grams": round(total_gold_equivalent, 6),
        "estimated_profit_loss_percent": round(((silver_as_gold - gold) / max(gold, 0.000001)) * 100, 2),
        "estimated_after_fees_percent": round(((silver_as_gold - gold) / max(gold, 0.000001)) * 100 - fee_drag_pct, 2),
    }
