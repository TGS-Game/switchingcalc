import enum
import uuid
from datetime import datetime

from sqlalchemy.dialects.postgresql import JSONB, UUID

from .. import db


def gen_uuid():
    return uuid.uuid4()


class Role(enum.Enum):
    user = "user"
    admin = "admin"


class MetalType(enum.Enum):
    gold = "gold"
    silver = "silver"


class TransactionType(enum.Enum):
    purchase = "purchase"
    switch_in = "switch_in"
    switch_out = "switch_out"
    sale = "sale"
    storage_fee = "storage_fee"
    adjustment = "adjustment"


class UploadStatus(enum.Enum):
    pending = "pending"
    processed = "processed"
    needs_review = "needs_review"
    failed = "failed"


class MappingStatus(enum.Enum):
    suggested = "suggested"
    confirmed = "confirmed"
    edited = "edited"


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    role = db.Column(db.Enum(Role), default=Role.user, nullable=False)
    two_factor_secret = db.Column(db.String(64))
    two_factor_enabled = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = db.Column(db.DateTime)


class UploadBatch(db.Model):
    __tablename__ = "upload_batches"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    checksum = db.Column(db.String(128), nullable=False, index=True)
    status = db.Column(db.Enum(UploadStatus), default=UploadStatus.pending, nullable=False)
    source_type = db.Column(db.String(16), nullable=False)  # csv/pdf/manual
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    raw_text = db.Column(db.Text)
    parser_version = db.Column(db.String(32), default="v1")


class RawStatementRow(db.Model):
    __tablename__ = "raw_statement_rows"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    upload_batch_id = db.Column(UUID(as_uuid=True), db.ForeignKey("upload_batches.id"), nullable=False)
    row_index = db.Column(db.Integer, nullable=False)
    raw_payload = db.Column(JSONB, nullable=False)
    normalized = db.Column(db.Boolean, default=False, nullable=False)


class Transaction(db.Model):
    __tablename__ = "transactions"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    upload_batch_id = db.Column(UUID(as_uuid=True), db.ForeignKey("upload_batches.id"))
    external_ref = db.Column(db.String(255), index=True)
    transaction_date = db.Column(db.Date, nullable=False, index=True)
    type = db.Column(db.Enum(TransactionType), nullable=False, index=True)
    metal = db.Column(db.Enum(MetalType), nullable=False)
    quantity_grams = db.Column(db.Numeric(18, 6), nullable=False)
    ratio = db.Column(db.Numeric(18, 6))
    notes = db.Column(db.Text)
    ambiguous = db.Column(db.Boolean, default=False, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    version = db.Column(db.Integer, default=1, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PositionLot(db.Model):
    __tablename__ = "position_lots"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    origin_transaction_id = db.Column(UUID(as_uuid=True), db.ForeignKey("transactions.id"), nullable=False)
    current_metal = db.Column(db.Enum(MetalType), nullable=False)
    original_quantity_grams = db.Column(db.Numeric(18, 6), nullable=False)
    remaining_quantity_grams = db.Column(db.Numeric(18, 6), nullable=False)
    opened_on = db.Column(db.Date, nullable=False)
    closed_on = db.Column(db.Date)
    lineage_root_id = db.Column(UUID(as_uuid=True))


class ReconciliationCase(db.Model):
    __tablename__ = "reconciliation_cases"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    transaction_id = db.Column(UUID(as_uuid=True), db.ForeignKey("transactions.id"), nullable=False)
    status = db.Column(db.String(32), default="open", nullable=False)
    suggested_allocations = db.Column(JSONB, default=list, nullable=False)
    resolved_allocations = db.Column(JSONB, default=list, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = db.Column(db.DateTime)


class LotAllocation(db.Model):
    __tablename__ = "lot_allocations"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    source_lot_id = db.Column(UUID(as_uuid=True), db.ForeignKey("position_lots.id"), nullable=False)
    target_transaction_id = db.Column(UUID(as_uuid=True), db.ForeignKey("transactions.id"), nullable=False)
    allocated_quantity_grams = db.Column(db.Numeric(18, 6), nullable=False)
    mapping_status = db.Column(db.Enum(MappingStatus), default=MappingStatus.suggested, nullable=False)
    metadata_json = db.Column(JSONB, default=dict, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class AlertRule(db.Model):
    __tablename__ = "alert_rules"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    target_ratio = db.Column(db.Numeric(18, 6), nullable=False)
    direction = db.Column(db.String(8), default="above", nullable=False)
    enabled = db.Column(db.Boolean, default=True, nullable=False)
    last_triggered_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(32), nullable=False)
    payload = db.Column(JSONB, default=dict, nullable=False)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    actor_user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"))
    subject_user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"))
    action = db.Column(db.String(128), nullable=False)
    entity_type = db.Column(db.String(64), nullable=False)
    entity_id = db.Column(db.String(64), nullable=False)
    before_json = db.Column(JSONB)
    after_json = db.Column(JSONB)
    ip_address = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class DataSnapshot(db.Model):
    __tablename__ = "data_snapshots"
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = db.Column(UUID(as_uuid=True), db.ForeignKey("users.id"), nullable=False, index=True)
    reason = db.Column(db.String(128), nullable=False)
    snapshot_json = db.Column(JSONB, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
