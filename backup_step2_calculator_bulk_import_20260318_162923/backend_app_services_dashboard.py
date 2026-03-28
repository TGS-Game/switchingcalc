from decimal import Decimal

from ..models.models import Transaction, TransactionType


def holdings_summary(user_id):
    gold = Decimal("0")
    silver = Decimal("0")
    switch_count = 0
    fees = Decimal("0")

    txs = (
        Transaction.query.filter_by(user_id=user_id, is_deleted=False)
        .order_by(Transaction.transaction_date.asc(), Transaction.created_at.asc())
        .all()
    )

    for tx in txs:
        qty = Decimal(str(tx.quantity_grams or 0))
        to_qty = Decimal(str(tx.to_quantity_grams or 0))

        if tx.type == TransactionType.purchase:
            if tx.metal and tx.metal.value == "gold":
                gold += qty
            elif tx.metal and tx.metal.value == "silver":
                silver += qty

        elif tx.type == TransactionType.transfer_in:
            if tx.metal and tx.metal.value == "gold":
                gold += qty
            elif tx.metal and tx.metal.value == "silver":
                silver += qty

        elif tx.type in {TransactionType.transfer_out, TransactionType.sale}:
            if tx.metal and tx.metal.value == "gold":
                gold -= qty
            elif tx.metal and tx.metal.value == "silver":
                silver -= qty

        elif tx.type in {TransactionType.depot_fee, TransactionType.storage_fee}:
            fees += qty
            if tx.metal and tx.metal.value == "gold":
                gold -= qty
            elif tx.metal and tx.metal.value == "silver":
                silver -= qty

        elif tx.type == TransactionType.switch:
            switch_count += 1
            if tx.from_metal and tx.from_metal.value == "gold":
                gold -= qty
            elif tx.from_metal and tx.from_metal.value == "silver":
                silver -= qty

            if tx.to_metal and tx.to_metal.value == "gold":
                gold += to_qty
            elif tx.to_metal and tx.to_metal.value == "silver":
                silver += to_qty

        elif tx.type == TransactionType.switch_in:
            switch_count += 1
            if tx.metal and tx.metal.value == "gold":
                gold += qty
            elif tx.metal and tx.metal.value == "silver":
                silver += qty

    return {
        "gold_grams": float(gold),
        "silver_grams": float(silver),
        "switch_count": switch_count,
        "storage_fee_grams": float(fees),
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
