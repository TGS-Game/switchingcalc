ALTER TABLE raw_statement_rows
    ADD COLUMN IF NOT EXISTS row_signature VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_raw_statement_rows_row_signature ON raw_statement_rows(row_signature);

CREATE TABLE IF NOT EXISTS saved_calculation_scenarios (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    scenario_name VARCHAR(255),
    notes TEXT,
    future_ratio NUMERIC(18,6) NOT NULL,
    fee_percent NUMERIC(5,2) NOT NULL DEFAULT 3,
    snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_calculation_scenarios_user_id
    ON saved_calculation_scenarios(user_id);
