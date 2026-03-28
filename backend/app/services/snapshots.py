import uuid
from datetime import date, datetime
from decimal import Decimal

from .. import db
from ..models.models import (
    AlertRule,
    DataSnapshot,
    LotAllocation,
    Notification,
    PositionLot,
    RawStatementRow,
    ReconciliationCase,
    SavedCalculationScenario,
    SuggestedTransaction,
    Transaction,
    UploadBatch,
)


def _uuid_or_none(value):
    if value in (None, ""):
        return None
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def _date_or_none(value):
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return date.fromisoformat(str(value))


def _datetime_or_none(value):
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def _decimal_or_none(value):
    if value in (None, ""):
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _enum_value_or_none(value):
    if value is None:
        return None
    return getattr(value, "value", value)


def _serialize_upload_batch(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "filename": row.filename,
        "checksum": row.checksum,
        "status": _enum_value_or_none(row.status),
        "source_type": row.source_type,
        "uploaded_at": row.uploaded_at.isoformat() if row.uploaded_at else None,
        "raw_text": row.raw_text,
        "parser_version": row.parser_version,
    }


def _serialize_raw_statement_row(row):
    return {
        "id": str(row.id),
        "upload_batch_id": str(row.upload_batch_id),
        "row_index": row.row_index,
        "raw_payload": row.raw_payload,
        "row_signature": row.row_signature,
        "normalized": bool(row.normalized),
    }


def _serialize_suggested_transaction(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "upload_batch_id": str(row.upload_batch_id),
        "source_row_id": str(row.source_row_id),
        "paired_row_id": str(row.paired_row_id) if row.paired_row_id else None,
        "group_key": row.group_key,
        "suggestion_type": row.suggestion_type,
        "metal": row.metal,
        "from_metal": row.from_metal,
        "to_metal": row.to_metal,
        "quantity_grams": str(row.quantity_grams) if row.quantity_grams is not None else None,
        "to_quantity_grams": str(row.to_quantity_grams) if row.to_quantity_grams is not None else None,
        "ratio": str(row.ratio) if row.ratio is not None else None,
        "notes": row.notes,
        "confidence": str(row.confidence) if row.confidence is not None else None,
        "review_status": row.review_status,
        "amended_type": row.amended_type,
        "amended_metal": row.amended_metal,
        "amended_from_metal": row.amended_from_metal,
        "amended_to_metal": row.amended_to_metal,
        "amended_quantity_grams": str(row.amended_quantity_grams) if row.amended_quantity_grams is not None else None,
        "amended_to_quantity_grams": str(row.amended_to_quantity_grams) if row.amended_to_quantity_grams is not None else None,
        "amended_ratio": str(row.amended_ratio) if row.amended_ratio is not None else None,
        "amended_notes": row.amended_notes,
        "confirmed_transaction_id": str(row.confirmed_transaction_id) if row.confirmed_transaction_id else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_transaction(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "upload_batch_id": str(row.upload_batch_id) if row.upload_batch_id else None,
        "source_suggestion_id": str(row.source_suggestion_id) if row.source_suggestion_id else None,
        "external_ref": row.external_ref,
        "transaction_date": row.transaction_date.isoformat() if row.transaction_date else None,
        "type": _enum_value_or_none(row.type),
        "metal": _enum_value_or_none(row.metal),
        "from_metal": _enum_value_or_none(row.from_metal),
        "to_metal": _enum_value_or_none(row.to_metal),
        "quantity_grams": str(row.quantity_grams) if row.quantity_grams is not None else None,
        "to_quantity_grams": str(row.to_quantity_grams) if row.to_quantity_grams is not None else None,
        "ratio": str(row.ratio) if row.ratio is not None else None,
        "notes": row.notes,
        "ambiguous": bool(row.ambiguous),
        "is_deleted": bool(row.is_deleted),
        "version": row.version,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_position_lot(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "origin_transaction_id": str(row.origin_transaction_id),
        "current_metal": _enum_value_or_none(row.current_metal),
        "original_quantity_grams": str(row.original_quantity_grams) if row.original_quantity_grams is not None else None,
        "remaining_quantity_grams": str(row.remaining_quantity_grams) if row.remaining_quantity_grams is not None else None,
        "opened_on": row.opened_on.isoformat() if row.opened_on else None,
        "closed_on": row.closed_on.isoformat() if row.closed_on else None,
        "lineage_root_id": str(row.lineage_root_id) if row.lineage_root_id else None,
    }


def _serialize_reconciliation_case(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "transaction_id": str(row.transaction_id),
        "status": row.status,
        "suggested_allocations": row.suggested_allocations,
        "resolved_allocations": row.resolved_allocations,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
    }


def _serialize_lot_allocation(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "source_lot_id": str(row.source_lot_id),
        "target_transaction_id": str(row.target_transaction_id),
        "allocated_quantity_grams": str(row.allocated_quantity_grams) if row.allocated_quantity_grams is not None else None,
        "mapping_status": _enum_value_or_none(row.mapping_status),
        "metadata_json": row.metadata_json,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _serialize_saved_calculation_scenario(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "scenario_name": row.scenario_name,
        "notes": row.notes,
        "future_ratio": str(row.future_ratio) if row.future_ratio is not None else None,
        "fee_percent": str(row.fee_percent) if row.fee_percent is not None else None,
        "snapshot_json": row.snapshot_json,
        "is_archived": bool(row.is_archived),
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _serialize_alert_rule(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "target_ratio": str(row.target_ratio) if row.target_ratio is not None else None,
        "direction": row.direction,
        "enabled": bool(row.enabled),
        "last_triggered_at": row.last_triggered_at.isoformat() if row.last_triggered_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def _serialize_notification(row):
    return {
        "id": str(row.id),
        "user_id": str(row.user_id),
        "type": row.type,
        "payload": row.payload,
        "read_at": row.read_at.isoformat() if row.read_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def build_user_snapshot_payload(user_id):
    user_uuid = _uuid_or_none(user_id)

    upload_batches = UploadBatch.query.filter_by(user_id=user_uuid).order_by(UploadBatch.uploaded_at.asc()).all()
    raw_statement_rows = (
        RawStatementRow.query
        .join(UploadBatch, RawStatementRow.upload_batch_id == UploadBatch.id)
        .filter(UploadBatch.user_id == user_uuid)
        .order_by(RawStatementRow.row_index.asc())
        .all()
    )
    suggested_transactions = (
        SuggestedTransaction.query
        .filter_by(user_id=user_uuid)
        .order_by(SuggestedTransaction.created_at.asc())
        .all()
    )
    transactions = (
        Transaction.query
        .filter_by(user_id=user_uuid)
        .order_by(Transaction.transaction_date.asc(), Transaction.created_at.asc())
        .all()
    )
    position_lots = (
        PositionLot.query
        .filter_by(user_id=user_uuid)
        .order_by(PositionLot.opened_on.asc())
        .all()
    )
    reconciliation_cases = (
        ReconciliationCase.query
        .filter_by(user_id=user_uuid)
        .order_by(ReconciliationCase.created_at.asc())
        .all()
    )
    lot_allocations = (
        LotAllocation.query
        .filter_by(user_id=user_uuid)
        .order_by(LotAllocation.created_at.asc())
        .all()
    )
    saved_scenarios = (
        SavedCalculationScenario.query
        .filter_by(user_id=user_uuid)
        .order_by(SavedCalculationScenario.created_at.asc())
        .all()
    )
    alert_rules = (
        AlertRule.query
        .filter_by(user_id=user_uuid)
        .order_by(AlertRule.created_at.asc())
        .all()
    )
    notifications = (
        Notification.query
        .filter_by(user_id=user_uuid)
        .order_by(Notification.created_at.asc())
        .all()
    )

    return {
        "meta": {
            "user_id": str(user_uuid),
            "captured_at": datetime.utcnow().isoformat(),
        },
        "upload_batches": [_serialize_upload_batch(row) for row in upload_batches],
        "raw_statement_rows": [_serialize_raw_statement_row(row) for row in raw_statement_rows],
        "suggested_transactions": [_serialize_suggested_transaction(row) for row in suggested_transactions],
        "transactions": [_serialize_transaction(row) for row in transactions],
        "position_lots": [_serialize_position_lot(row) for row in position_lots],
        "reconciliation_cases": [_serialize_reconciliation_case(row) for row in reconciliation_cases],
        "lot_allocations": [_serialize_lot_allocation(row) for row in lot_allocations],
        "saved_calculation_scenarios": [_serialize_saved_calculation_scenario(row) for row in saved_scenarios],
        "alert_rules": [_serialize_alert_rule(row) for row in alert_rules],
        "notifications": [_serialize_notification(row) for row in notifications],
    }


def create_data_snapshot(user_id, reason, actor_user_id=None, extra_meta=None):
    payload = build_user_snapshot_payload(user_id)
    payload["meta"]["reason"] = reason
    payload["meta"]["actor_user_id"] = str(actor_user_id) if actor_user_id else str(user_id)
    if extra_meta:
        payload["meta"]["extra"] = extra_meta

    row = DataSnapshot(
        user_id=_uuid_or_none(user_id),
        reason=reason,
        snapshot_json=payload,
    )
    db.session.add(row)
    db.session.commit()
    return row


def list_data_snapshots(user_id):
    user_uuid = _uuid_or_none(user_id)
    rows = DataSnapshot.query.filter_by(user_id=user_uuid).order_by(DataSnapshot.created_at.desc()).all()
    result = []
    for row in rows:
        meta = (row.snapshot_json or {}).get("meta", {})
        result.append({
            "id": str(row.id),
            "user_id": str(row.user_id),
            "reason": row.reason,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "captured_at": meta.get("captured_at"),
            "actor_user_id": meta.get("actor_user_id"),
            "extra": meta.get("extra"),
            "counts": {
                "upload_batches": len((row.snapshot_json or {}).get("upload_batches", [])),
                "raw_statement_rows": len((row.snapshot_json or {}).get("raw_statement_rows", [])),
                "suggested_transactions": len((row.snapshot_json or {}).get("suggested_transactions", [])),
                "transactions": len((row.snapshot_json or {}).get("transactions", [])),
                "position_lots": len((row.snapshot_json or {}).get("position_lots", [])),
                "reconciliation_cases": len((row.snapshot_json or {}).get("reconciliation_cases", [])),
                "lot_allocations": len((row.snapshot_json or {}).get("lot_allocations", [])),
            },
        })
    return result


def _clear_user_state(user_id, delete_snapshots=False):
    user_uuid = _uuid_or_none(user_id)

    batches = UploadBatch.query.filter_by(user_id=user_uuid).all()
    batch_ids = [b.id for b in batches]

    transactions = Transaction.query.filter_by(user_id=user_uuid).all()
    transaction_ids = [t.id for t in transactions]

    lots = PositionLot.query.filter_by(user_id=user_uuid).all()
    lot_ids = [l.id for l in lots]

    if lot_ids:
        LotAllocation.query.filter(LotAllocation.source_lot_id.in_(lot_ids)).delete(synchronize_session=False)

    if transaction_ids:
        LotAllocation.query.filter(LotAllocation.target_transaction_id.in_(transaction_ids)).delete(synchronize_session=False)
        ReconciliationCase.query.filter(ReconciliationCase.transaction_id.in_(transaction_ids)).delete(synchronize_session=False)

    PositionLot.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    ReconciliationCase.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    Transaction.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    SuggestedTransaction.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    SavedCalculationScenario.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    AlertRule.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)
    Notification.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)

    if delete_snapshots:
        DataSnapshot.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)

    if batch_ids:
        RawStatementRow.query.filter(RawStatementRow.upload_batch_id.in_(batch_ids)).delete(synchronize_session=False)

    UploadBatch.query.filter_by(user_id=user_uuid).delete(synchronize_session=False)


def restore_data_snapshot(snapshot_id, actor_user_id=None):
    snapshot = DataSnapshot.query.filter_by(id=_uuid_or_none(snapshot_id)).first_or_404()
    payload = snapshot.snapshot_json or {}
    meta = payload.get("meta", {})
    user_id = _uuid_or_none(snapshot.user_id)

    _clear_user_state(user_id, delete_snapshots=False)

    for row in payload.get("upload_batches", []):
        db.session.add(UploadBatch(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            filename=row.get("filename"),
            checksum=row.get("checksum"),
            status=row.get("status"),
            source_type=row.get("source_type"),
            uploaded_at=_datetime_or_none(row.get("uploaded_at")),
            raw_text=row.get("raw_text"),
            parser_version=row.get("parser_version"),
        ))

    for row in payload.get("raw_statement_rows", []):
        db.session.add(RawStatementRow(
            id=_uuid_or_none(row.get("id")),
            upload_batch_id=_uuid_or_none(row.get("upload_batch_id")),
            row_index=row.get("row_index"),
            raw_payload=row.get("raw_payload"),
            row_signature=row.get("row_signature"),
            normalized=bool(row.get("normalized")),
        ))

    for row in payload.get("suggested_transactions", []):
        db.session.add(SuggestedTransaction(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            upload_batch_id=_uuid_or_none(row.get("upload_batch_id")),
            source_row_id=_uuid_or_none(row.get("source_row_id")),
            paired_row_id=_uuid_or_none(row.get("paired_row_id")),
            group_key=row.get("group_key"),
            suggestion_type=row.get("suggestion_type"),
            metal=row.get("metal"),
            from_metal=row.get("from_metal"),
            to_metal=row.get("to_metal"),
            quantity_grams=_decimal_or_none(row.get("quantity_grams")),
            to_quantity_grams=_decimal_or_none(row.get("to_quantity_grams")),
            ratio=_decimal_or_none(row.get("ratio")),
            notes=row.get("notes"),
            confidence=_decimal_or_none(row.get("confidence")) or Decimal("0"),
            review_status=row.get("review_status") or "pending",
            amended_type=row.get("amended_type"),
            amended_metal=row.get("amended_metal"),
            amended_from_metal=row.get("amended_from_metal"),
            amended_to_metal=row.get("amended_to_metal"),
            amended_quantity_grams=_decimal_or_none(row.get("amended_quantity_grams")),
            amended_to_quantity_grams=_decimal_or_none(row.get("amended_to_quantity_grams")),
            amended_ratio=_decimal_or_none(row.get("amended_ratio")),
            amended_notes=row.get("amended_notes"),
            confirmed_transaction_id=_uuid_or_none(row.get("confirmed_transaction_id")),
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
            updated_at=_datetime_or_none(row.get("updated_at")) or datetime.utcnow(),
        ))

    for row in payload.get("transactions", []):
        db.session.add(Transaction(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            upload_batch_id=_uuid_or_none(row.get("upload_batch_id")),
            source_suggestion_id=_uuid_or_none(row.get("source_suggestion_id")),
            external_ref=row.get("external_ref"),
            transaction_date=_date_or_none(row.get("transaction_date")),
            type=row.get("type"),
            metal=row.get("metal"),
            from_metal=row.get("from_metal"),
            to_metal=row.get("to_metal"),
            quantity_grams=_decimal_or_none(row.get("quantity_grams")),
            to_quantity_grams=_decimal_or_none(row.get("to_quantity_grams")),
            ratio=_decimal_or_none(row.get("ratio")),
            notes=row.get("notes"),
            ambiguous=bool(row.get("ambiguous")),
            is_deleted=bool(row.get("is_deleted")),
            version=row.get("version") or 1,
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
            updated_at=_datetime_or_none(row.get("updated_at")),
        ))

    for row in payload.get("position_lots", []):
        db.session.add(PositionLot(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            origin_transaction_id=_uuid_or_none(row.get("origin_transaction_id")),
            current_metal=row.get("current_metal"),
            original_quantity_grams=_decimal_or_none(row.get("original_quantity_grams")),
            remaining_quantity_grams=_decimal_or_none(row.get("remaining_quantity_grams")),
            opened_on=_date_or_none(row.get("opened_on")),
            closed_on=_date_or_none(row.get("closed_on")),
            lineage_root_id=_uuid_or_none(row.get("lineage_root_id")),
        ))

    for row in payload.get("reconciliation_cases", []):
        db.session.add(ReconciliationCase(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            transaction_id=_uuid_or_none(row.get("transaction_id")),
            status=row.get("status") or "open",
            suggested_allocations=row.get("suggested_allocations") or [],
            resolved_allocations=row.get("resolved_allocations") or [],
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
            resolved_at=_datetime_or_none(row.get("resolved_at")),
        ))

    for row in payload.get("lot_allocations", []):
        db.session.add(LotAllocation(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            source_lot_id=_uuid_or_none(row.get("source_lot_id")),
            target_transaction_id=_uuid_or_none(row.get("target_transaction_id")),
            allocated_quantity_grams=_decimal_or_none(row.get("allocated_quantity_grams")),
            mapping_status=row.get("mapping_status"),
            metadata_json=row.get("metadata_json") or {},
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
        ))

    for row in payload.get("saved_calculation_scenarios", []):
        db.session.add(SavedCalculationScenario(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            scenario_name=row.get("scenario_name"),
            notes=row.get("notes"),
            future_ratio=_decimal_or_none(row.get("future_ratio")),
            fee_percent=_decimal_or_none(row.get("fee_percent")) or Decimal("3"),
            snapshot_json=row.get("snapshot_json") or {},
            is_archived=bool(row.get("is_archived")),
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
            updated_at=_datetime_or_none(row.get("updated_at")) or datetime.utcnow(),
        ))

    for row in payload.get("alert_rules", []):
        db.session.add(AlertRule(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            target_ratio=_decimal_or_none(row.get("target_ratio")),
            direction=row.get("direction") or "above",
            enabled=bool(row.get("enabled")),
            last_triggered_at=_datetime_or_none(row.get("last_triggered_at")),
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
        ))

    for row in payload.get("notifications", []):
        db.session.add(Notification(
            id=_uuid_or_none(row.get("id")),
            user_id=_uuid_or_none(row.get("user_id")),
            type=row.get("type"),
            payload=row.get("payload") or {},
            read_at=_datetime_or_none(row.get("read_at")),
            created_at=_datetime_or_none(row.get("created_at")) or datetime.utcnow(),
        ))

    db.session.commit()

    return {
        "status": "ok",
        "restored_snapshot_id": str(snapshot.id),
        "user_id": str(user_id),
        "reason": snapshot.reason,
        "captured_at": meta.get("captured_at"),
        "restored_by": str(actor_user_id) if actor_user_id else None,
    }