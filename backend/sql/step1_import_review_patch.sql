DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactiontype') THEN
        ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'transfer_in';
        ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'transfer_out';
        ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'depot_fee';
        ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'switch';
    END IF;
END $$;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS source_suggestion_id UUID,
    ADD COLUMN IF NOT EXISTS from_metal metaltype,
    ADD COLUMN IF NOT EXISTS to_metal metaltype,
    ADD COLUMN IF NOT EXISTS to_quantity_grams NUMERIC(18,6);

ALTER TABLE transactions
    ALTER COLUMN metal DROP NOT NULL;

CREATE TABLE IF NOT EXISTS suggested_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    upload_batch_id UUID NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
    source_row_id UUID NOT NULL REFERENCES raw_statement_rows(id) ON DELETE CASCADE,
    paired_row_id UUID REFERENCES raw_statement_rows(id) ON DELETE SET NULL,
    group_key VARCHAR(255),
    suggestion_type VARCHAR(32) NOT NULL,
    metal VARCHAR(32),
    from_metal VARCHAR(32),
    to_metal VARCHAR(32),
    quantity_grams NUMERIC(18,6),
    to_quantity_grams NUMERIC(18,6),
    ratio NUMERIC(18,6),
    notes TEXT,
    confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
    review_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    amended_type VARCHAR(32),
    amended_metal VARCHAR(32),
    amended_from_metal VARCHAR(32),
    amended_to_metal VARCHAR(32),
    amended_quantity_grams NUMERIC(18,6),
    amended_to_quantity_grams NUMERIC(18,6),
    amended_ratio NUMERIC(18,6),
    amended_notes TEXT,
    confirmed_transaction_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggested_transactions_user_id ON suggested_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_transactions_upload_batch_id ON suggested_transactions(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_suggested_transactions_review_status ON suggested_transactions(review_status);
CREATE INDEX IF NOT EXISTS idx_suggested_transactions_group_key ON suggested_transactions(group_key);
