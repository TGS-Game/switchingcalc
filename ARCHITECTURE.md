# Architecture

## 1. Application layers

### Frontend
- React SPA
- Authenticated pages for dashboard, uploads, reconciliation, transactions, calculator, alerts
- Inline banner for admin support view
- Autosave on forms and draft allocations

### API
- Flask REST API
- JWT authentication + optional TOTP 2FA
- Upload processor for CSV and PDF statements
- Reconciliation engine for ambiguous mapping
- Dashboard aggregation and calculator engine
- Audit trail service for data edits and admin access

### Data
- PostgreSQL stores normalized transactions, batches, raw rows, lots, allocations, audit logs, snapshots, alerts
- Version fields and snapshots support restore / historical inspection
- Only grams, dates, ratios, metal types, and security metadata are stored

## 2. Core domain flow
1. User uploads CSV or PDF.
2. Parser stores raw rows per upload batch.
3. Normalizer writes transactions without money values.
4. Ambiguous switch and sale transactions generate reconciliation cases.
5. FIFO-based suggestion engine proposes source lot allocations.
6. User confirms or edits allocations.
7. Position engine rebuilds all lots and downstream lineage.
8. Dashboard and calculator read only from normalized lots / allocations.

## 3. Lineage design
- `Transaction` = immutable investment event versioned over edits.
- `PositionLot` = persistent descendant of an originating purchase or switch result.
- `LotAllocation` = edges between lots and outgoing transactions.
- `lineage_root_id` preserves journey across splits, merges, fees, and switches.

## 4. Security and privacy
- Hash passwords with bcrypt.
- JWT sessions, optional TOTP 2FA.
- Minimized data model with no stored currency.
- Audit every admin and user-changing action.
- Soft delete + snapshotting supports GDPR export/delete workflows.

## 5. Reconciliation UX
- Show ambiguous switch or sale item.
- Show conservative FIFO suggestion.
- Permit many-to-one and one-to-many allocations.
- Save partial allocations continuously.
- Rebuild lineage after each confirmation.

## 6. Deployment
- Docker Compose for app + Postgres.
- Can be placed behind Nginx / Caddy with HTTPS.
- Move secrets to managed secret store in production.
- Add object storage for uploaded statement originals if retention is needed.
