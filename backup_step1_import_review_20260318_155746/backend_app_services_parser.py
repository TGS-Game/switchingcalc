import csv
import hashlib
import io
from datetime import datetime
from decimal import Decimal

import pdfplumber

from .. import db
from ..models.models import MetalType, RawStatementRow, Transaction, TransactionType, UploadBatch, UploadStatus


FIELD_MAP = {
    "date": ["date", "transaction date"],
    "metal": ["metal", "metal type"],
    "grams": ["grams", "quantity", "quantity (g)", "g"],
    "ratio": ["ratio", "gold-silver ratio", "gsr"],
    "type": ["type", "transaction type", "activity"],
}

TYPE_MAP = {
    "purchase": TransactionType.purchase,
    "buy": TransactionType.purchase,
    "switch in": TransactionType.switch_in,
    "switch out": TransactionType.switch_out,
    "sale": TransactionType.sale,
    "sell": TransactionType.sale,
    "storage fee": TransactionType.storage_fee,
    "fee": TransactionType.storage_fee,
    "adjustment": TransactionType.adjustment,
}


def checksum_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_pdf_rows(file_bytes: bytes):
    rows = []
    text_parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            table = page.extract_table() or []
            page_text = page.extract_text() or ""
            text_parts.append(page_text)
            for idx, row in enumerate(table):
                rows.append({"row_index": len(rows), "cells": row, "text": " | ".join([c or "" for c in row])})
    return rows, "\n".join(text_parts)


def _normalize_header(name: str) -> str:
    return name.strip().lower()


def _find_field(row, key):
    candidates = FIELD_MAP[key]
    for field_name, value in row.items():
        if _normalize_header(field_name) in candidates:
            return value
    return None


def _metal(value: str):
    val = str(value).strip().lower()
    if val not in {"gold", "silver"}:
        raise ValueError(f"Unsupported metal: {value}")
    return MetalType(val)


def _type(value: str):
    val = str(value).strip().lower()
    if val not in TYPE_MAP:
        raise ValueError(f"Unsupported transaction type: {value}")
    return TYPE_MAP[val]


def parse_csv_rows(file_bytes: bytes):
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def normalize_transactions(user_id, upload_batch_id, rows):
    created = []
    for idx, row in enumerate(rows):
        db.session.add(RawStatementRow(upload_batch_id=upload_batch_id, row_index=idx, raw_payload=row, normalized=True))
        tx = Transaction(
            user_id=user_id,
            upload_batch_id=upload_batch_id,
            external_ref=row.get("reference") or row.get("id") or f"{upload_batch_id}:{idx}",
            transaction_date=datetime.strptime(_find_field(row, "date"), "%Y-%m-%d").date(),
            type=_type(_find_field(row, "type")),
            metal=_metal(_find_field(row, "metal")),
            quantity_grams=Decimal(str(_find_field(row, "grams"))),
            ratio=Decimal(str(_find_field(row, "ratio"))) if _find_field(row, "ratio") not in (None, "") else None,
            ambiguous=_type(_find_field(row, "type")) in {TransactionType.switch_in, TransactionType.sale},
            notes=row.get("notes"),
        )
        db.session.add(tx)
        created.append(tx)
    return created


def create_upload(user_id, filename, source_type, file_bytes):
    batch = UploadBatch(
        user_id=user_id,
        filename=filename,
        checksum=checksum_bytes(file_bytes),
        source_type=source_type,
        status=UploadStatus.pending,
    )
    db.session.add(batch)
    db.session.flush()

    if source_type == "csv":
        rows = parse_csv_rows(file_bytes)
        batch.raw_text = None
    else:
        rows, raw_text = parse_pdf_rows(file_bytes)
        batch.raw_text = raw_text
        batch.status = UploadStatus.needs_review

    normalize_transactions(user_id, batch.id, rows)
    batch.status = UploadStatus.processed if source_type == "csv" else UploadStatus.needs_review
    db.session.commit()
    return batch
