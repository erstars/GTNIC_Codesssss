-- Brings a database made with an older schema.sql up to date.
-- Existing data is kept, and it is safe to run more than once.
--
--   psql -U postgres -h localhost -d usahacerdas -f database/upgrade.sql

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(60)  NOT NULL,
  username      VARCHAR(40)  NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS store_settings (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  name       VARCHAR(60) NOT NULL DEFAULT 'UsahaCerdas',
  address    VARCHAR(200),
  phone      VARCHAR(30),
  footer     VARCHAR(200),
  logo       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category VARCHAR(40),
  ADD COLUMN IF NOT EXISTS barcode VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique
  ON products (barcode) WHERE barcode IS NOT NULL;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10) NOT NULL DEFAULT 'TUNAI'
    CHECK (payment_method IN ('TUNAI', 'QRIS', 'TRANSFER')),
  ADD COLUMN IF NOT EXISTS discount NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(60),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS stock_movements (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id     TEXT        REFERENCES products (id) ON DELETE SET NULL,
  product_name   VARCHAR(60) NOT NULL,
  change         INTEGER     NOT NULL CHECK (change <> 0),
  stock_after    INTEGER     NOT NULL,
  reason         VARCHAR(10) NOT NULL
                 CHECK (reason IN ('AWAL', 'RESTOK', 'KOREKSI', 'JUAL', 'BATAL')),
  note           VARCHAR(200),
  transaction_id TEXT        REFERENCES transactions (id) ON DELETE SET NULL,
  user_name      VARCHAR(60),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements (created_at);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements (product_id);

CREATE TABLE IF NOT EXISTS expenses (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        DATE           NOT NULL,
  category    VARCHAR(40)    NOT NULL,
  description VARCHAR(200),
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  user_name   VARCHAR(60),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date);

DROP VIEW IF EXISTS transaction_totals;

CREATE VIEW transaction_totals AS
SELECT t.id,
       t.date,
       t.payment_method,
       t.payment,
       t.change_amount,
       t.discount,
       t.cashier_name,
       t.cancelled_at,
       COALESCE(SUM(i.price * i.quantity), 0) - t.discount            AS total,
       COALESCE(SUM((i.price - i.cost) * i.quantity), 0) - t.discount AS profit
FROM transactions t
LEFT JOIN transaction_items i ON i.transaction_id = t.id
GROUP BY t.id;

COMMIT;
