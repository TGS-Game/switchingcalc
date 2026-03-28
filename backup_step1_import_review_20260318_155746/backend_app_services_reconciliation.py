from collections import deque
from decimal import Decimal
from datetime import datetime

from .. import db
from ..models.models import (
    LotAllocation,
    MappingStatus,
    MetalType,
    PositionLot,
    ReconciliationCase,
    Transaction,
    TransactionType,
)


def conservative_fifo_candidates(user_id, transaction):
    eligible = (
        PositionLot.query.filter_by(user_id=user_id, closed_on=None)
        .filter(PositionLot.remaining_quantity_grams > 0)
        .order_by(PositionLot.opened_on.asc())
        .all()
    )
    if transaction.type == TransactionType.sale:
        eligible = [lot for lot in eligible if lot.current_metal == transaction.metal]
    if transaction.type == TransactionType.switch_in:
        source_metal = MetalType.gold if transaction.metal == MetalType.silver else MetalType.silver
        eligible = [lot for lot in eligible if lot.current_metal == source_metal]

    remaining = Decimal(str(transaction.quantity_grams))
    suggestions = []
    for lot in eligible:
        if remaining <= 0:
            break
        alloc = min(Decimal(str(lot.remaining_quantity_grams)), remaining)
        if alloc > 0:
            suggestions.append({"source_lot_id": str(lot.id), "allocated_quantity_grams": float(alloc)})
            remaining -= alloc
    return suggestions


def build_reconciliation_cases(user_id):
    open_items = Transaction.query.filter_by(user_id=user_id, ambiguous=True, is_deleted=False).all()
    cases = []
    for tx in open_items:
        existing = ReconciliationCase.query.filter_by(transaction_id=tx.id).first()
        if existing:
            cases.append(existing)
            continue
        case = ReconciliationCase(
            user_id=user_id,
            transaction_id=tx.id,
            suggested_allocations=conservative_fifo_candidates(user_id, tx),
        )
        db.session.add(case)
        cases.append(case)
    db.session.commit()
    return cases


def rebuild_positions(user_id):
    PositionLot.query.filter_by(user_id=user_id).delete()
    LotAllocation.query.filter_by(user_id=user_id).delete()
    db.session.flush()

    txs = (
        Transaction.query.filter_by(user_id=user_id, is_deleted=False)
        .order_by(Transaction.transaction_date.asc(), Transaction.created_at.asc())
        .all()
    )
    open_lots = deque()

    for tx in txs:
        qty = Decimal(str(tx.quantity_grams))
        if tx.type == TransactionType.purchase:
            lot = PositionLot(
                user_id=user_id,
                origin_transaction_id=tx.id,
                current_metal=tx.metal,
                original_quantity_grams=qty,
                remaining_quantity_grams=qty,
                opened_on=tx.transaction_date,
                lineage_root_id=tx.id,
            )
            db.session.add(lot)
            open_lots.append(lot)

        elif tx.type in {TransactionType.sale, TransactionType.storage_fee, TransactionType.switch_in}:
            case = ReconciliationCase.query.filter_by(transaction_id=tx.id).first()
            allocations = (case.resolved_allocations if case and case.resolved_allocations else conservative_fifo_candidates(user_id, tx))
            for entry in allocations:
                lot = next((x for x in list(open_lots) if str(x.id) == entry["source_lot_id"]), None)
                if not lot:
                    continue
                amount = Decimal(str(entry["allocated_quantity_grams"]))
                lot.remaining_quantity_grams -= amount
                if lot.remaining_quantity_grams <= 0:
                    lot.closed_on = tx.transaction_date
                db.session.add(LotAllocation(
                    user_id=user_id,
                    source_lot_id=lot.id,
                    target_transaction_id=tx.id,
                    allocated_quantity_grams=amount,
                    mapping_status=MappingStatus.confirmed if case and case.resolved_allocations else MappingStatus.suggested,
                ))
                if tx.type == TransactionType.switch_in:
                    ratio = Decimal(str(tx.ratio or 1))
                    switched_qty = amount / ratio if tx.metal == MetalType.gold else amount * ratio
                    db.session.add(PositionLot(
                        user_id=user_id,
                        origin_transaction_id=tx.id,
                        current_metal=tx.metal,
                        original_quantity_grams=switched_qty,
                        remaining_quantity_grams=switched_qty,
                        opened_on=tx.transaction_date,
                        lineage_root_id=lot.lineage_root_id or lot.origin_transaction_id,
                    ))
    db.session.commit()


def resolve_case(case, allocations):
    case.resolved_allocations = allocations
    case.status = "resolved"
    case.resolved_at = datetime.utcnow()
    db.session.commit()
    rebuild_positions(case.user_id)
    return case
