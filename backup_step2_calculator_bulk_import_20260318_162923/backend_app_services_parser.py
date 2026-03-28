import csv
import hashlib
import io
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .. import db
from ..models.models import RawStatementRow, SuggestedTransaction, UploadBatch, UploadStatus


PURCHASE_RE = re.compile(r"^(Gold|Silver)\s+purchase\s+([+-]?\d+(?:[.,]\d+)?)\s*Gramm$", re.IGNORECASE)
TRANSFER_RE = re.compile(r"^(Gold|Silver)\s+([+-]?\d+(?:[.,]\d+)?)\s*Gramm$", re.IGNORECASE)
DEPOT_FEE_RE = re.compile(r"depot\s*fee|storage\s*fee|verwahr|lager", re.IGNORECASE)
CLEAR_CASH_NOISE_RE = re.compile(r"bank transfer|wire transfer|sepa|cash deposit|cash withdrawal|zahlung|ueberweisung|überweisung", re.IGNORECASE)


def checksum_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _field(payload, *names):
    lowered = {str(k).strip().lower(): v for k, v in (payload or {}).items()}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    return None


def _text(value):
    return (value or "").strip()


def _parse_decimal(value):
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    s = s.replace("€", "").replace("EUR", "").replace("Gramm", "").replace("gramm", "").replace("g", "").replace(" ", "")
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(".", "").replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def _parse_date(value):
    if value is None:
        return None
    s = str(value).strip()
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_csv_rows(file_bytes: bytes):
    text = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader), text


def _ignore_reason(definition):
    d = _text(definition)
    if d.startswith("ZA"):
        return "Ignored: ZA row"
    if d.lower() == "cancelled switch":
        return "Ignored: Cancelled Switch"
    return None


def _looks_like_cash_noise(payload):
    definition = _text(_field(payload, "Definition"))
    amount = _field(payload, "Amount (EUR)")
    lower = definition.lower()

    if "gold" in lower or "silver" in lower or "gramm" in lower:
        return False

    if amount in (None, "", "0", "0.00", "0,00"):
        return False

    if CLEAR_CASH_NOISE_RE.search(definition):
        return True

    return False


def _classify_single(payload):
    definition = _text(_field(payload, "Definition"))
    ratio = _parse_decimal(_field(payload, "Gold-Silver-Ratio"))

    reason = _ignore_reason(definition)
    if reason:
        return {
            "suggestion_type": "ignored",
            "metal": None,
            "from_metal": None,
            "to_metal": None,
            "quantity_grams": None,
            "to_quantity_grams": None,
            "ratio": ratio,
            "notes": reason,
            "confidence": Decimal("1.00"),
        }

    m = PURCHASE_RE.match(definition)
    if m:
        metal = m.group(1).lower()
        grams = _parse_decimal(m.group(2))
        return {
            "suggestion_type": "purchase",
            "metal": metal,
            "from_metal": None,
            "to_metal": None,
            "quantity_grams": grams,
            "to_quantity_grams": None,
            "ratio": ratio,
            "notes": f"{metal.title()} purchase detected",
            "confidence": Decimal("0.98"),
        }

    m = TRANSFER_RE.match(definition)
    if m:
        metal = m.group(1).lower()
        grams = _parse_decimal(m.group(2))
        if grams is not None and grams < 0:
            return {
                "suggestion_type": "transfer_out",
                "metal": metal,
                "from_metal": None,
                "to_metal": None,
                "quantity_grams": abs(grams),
                "to_quantity_grams": None,
                "ratio": ratio,
                "notes": f"{metal.title()} transfer out detected",
                "confidence": Decimal("0.90"),
            }
        if grams is not None and grams > 0:
            return {
                "suggestion_type": "transfer_in",
                "metal": metal,
                "from_metal": None,
                "to_metal": None,
                "quantity_grams": grams,
                "to_quantity_grams": None,
                "ratio": ratio,
                "notes": f"{metal.title()} transfer in detected",
                "confidence": Decimal("0.90"),
            }

    if DEPOT_FEE_RE.search(definition):
        metal = None
        if "gold" in definition.lower():
            metal = "gold"
        elif "silver" in definition.lower():
            metal = "silver"
        grams_match = re.search(r"([+-]?\d+(?:[.,]\d+)?)\s*Gramm", definition, re.IGNORECASE)
        grams = _parse_decimal(grams_match.group(1)) if grams_match else None
        return {
            "suggestion_type": "depot_fee",
            "metal": metal,
            "from_metal": None,
            "to_metal": None,
            "quantity_grams": abs(grams) if grams is not None else None,
            "to_quantity_grams": None,
            "ratio": ratio,
            "notes": "Depot fee detected",
            "confidence": Decimal("0.75") if grams is not None else Decimal("0.55"),
        }

    if _looks_like_cash_noise(payload):
        return {
            "suggestion_type": "ignored",
            "metal": None,
            "from_metal": None,
            "to_metal": None,
            "quantity_grams": None,
            "to_quantity_grams": None,
            "ratio": ratio,
            "notes": "Ignored: likely cash/noise row",
            "confidence": Decimal("0.85"),
        }

    return {
        "suggestion_type": "unknown",
        "metal": None,
        "from_metal": None,
        "to_metal": None,
        "quantity_grams": None,
        "to_quantity_grams": None,
        "ratio": ratio,
        "notes": "Could not classify automatically",
        "confidence": Decimal("0.20"),
    }


def _transfer_parts(payload):
    definition = _text(_field(payload, "Definition"))
    m = TRANSFER_RE.match(definition)
    if not m:
        return None
    metal = m.group(1).lower()
    grams = _parse_decimal(m.group(2))
    if grams is None:
        return None
    return metal, grams


def _detect_switch(row_a, row_b):
    payload_a = row_a.raw_payload
    payload_b = row_b.raw_payload

    date_a = _parse_date(_field(payload_a, "Date"))
    date_b = _parse_date(_field(payload_b, "Date"))
    if date_a != date_b:
        return None

    parts_a = _transfer_parts(payload_a)
    parts_b = _transfer_parts(payload_b)
    if not parts_a or not parts_b:
        return None

    metal_a, grams_a = parts_a
    metal_b, grams_b = parts_b

    if metal_a == metal_b:
        return None

    if grams_a < 0 and grams_b > 0:
        return {
            "source_row": row_a,
            "paired_row": row_b,
            "from_metal": metal_a,
            "to_metal": metal_b,
            "quantity_grams": abs(grams_a),
            "to_quantity_grams": grams_b,
            "ratio": _parse_decimal(_field(payload_a, "Gold-Silver-Ratio")) or _parse_decimal(_field(payload_b, "Gold-Silver-Ratio")),
            "notes": f"Switch detected: {metal_a} {abs(grams_a)}g -> {metal_b} {grams_b}g",
            "confidence": Decimal("0.95"),
        }

    if grams_b < 0 and grams_a > 0:
        return {
            "source_row": row_b,
            "paired_row": row_a,
            "from_metal": metal_b,
            "to_metal": metal_a,
            "quantity_grams": abs(grams_b),
            "to_quantity_grams": grams_a,
            "ratio": _parse_decimal(_field(payload_a, "Gold-Silver-Ratio")) or _parse_decimal(_field(payload_b, "Gold-Silver-Ratio")),
            "notes": f"Switch detected: {metal_b} {abs(grams_b)}g -> {metal_a} {grams_a}g",
            "confidence": Decimal("0.95"),
        }

    return None


def build_suggestions_for_batch(user_id, upload_batch_id):
    SuggestedTransaction.query.filter_by(upload_batch_id=upload_batch_id).delete()
    db.session.flush()

    rows = (
        RawStatementRow.query.filter_by(upload_batch_id=upload_batch_id)
        .order_by(RawStatementRow.row_index.asc())
        .all()
    )

    used_ids = set()
    suggestions = []

    for i, row_a in enumerate(rows):
        if row_a.id in used_ids:
            continue

        for j in range(i + 1, min(i + 6, len(rows))):
            row_b = rows[j]
            if row_b.id in used_ids:
                continue
            switch = _detect_switch(row_a, row_b)
            if switch:
                st = SuggestedTransaction(
                    user_id=user_id,
                    upload_batch_id=upload_batch_id,
                    source_row_id=switch["source_row"].id,
                    paired_row_id=switch["paired_row"].id,
                    group_key=f"switch:{upload_batch_id}:{switch['source_row'].id}:{switch['paired_row'].id}",
                    suggestion_type="switch",
                    from_metal=switch["from_metal"],
                    to_metal=switch["to_metal"],
                    quantity_grams=switch["quantity_grams"],
                    to_quantity_grams=switch["to_quantity_grams"],
                    ratio=switch["ratio"],
                    notes=switch["notes"],
                    confidence=switch["confidence"],
                    review_status="pending",
                )
                db.session.add(st)
                suggestions.append(st)
                used_ids.add(row_a.id)
                used_ids.add(row_b.id)
                break

    for row in rows:
        if row.id in used_ids:
            continue
        suggestion = _classify_single(row.raw_payload)
        st = SuggestedTransaction(
            user_id=user_id,
            upload_batch_id=upload_batch_id,
            source_row_id=row.id,
            group_key=f"single:{upload_batch_id}:{row.id}",
            suggestion_type=suggestion["suggestion_type"],
            metal=suggestion["metal"],
            from_metal=suggestion["from_metal"],
            to_metal=suggestion["to_metal"],
            quantity_grams=suggestion["quantity_grams"],
            to_quantity_grams=suggestion["to_quantity_grams"],
            ratio=suggestion["ratio"],
            notes=suggestion["notes"],
            confidence=suggestion["confidence"],
            review_status="pending",
        )
        db.session.add(st)
        suggestions.append(st)

    db.session.commit()
    return suggestions


def create_upload(user_id, filename, source_type, file_bytes):
    if source_type != "csv":
        raise ValueError("Only CSV uploads are supported in this step")

    rows, raw_text = parse_csv_rows(file_bytes)

    batch = UploadBatch(
        user_id=user_id,
        filename=filename,
        checksum=checksum_bytes(file_bytes),
        source_type=source_type,
        status=UploadStatus.pending,
        raw_text=raw_text,
        parser_version="step1-review-v1",
    )
    db.session.add(batch)
    db.session.flush()

    for idx, row in enumerate(rows, start=1):
        db.session.add(
            RawStatementRow(
                upload_batch_id=batch.id,
                row_index=idx,
                raw_payload=row,
                normalized=True,
            )
        )

    db.session.flush()
    suggestions = build_suggestions_for_batch(user_id, batch.id)
    batch.status = UploadStatus.needs_review
    db.session.commit()
    return batch, suggestions
