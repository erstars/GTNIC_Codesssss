-- UsahaCerdas database (PostgreSQL)
-- Stores everything used by lomba.js through server.js.
--
-- Apply to an empty database with:
--   psql -U postgres -h localhost -d usahacerdas -f database/schema.sql

BEGIN;

-- Akun: OWNER can do everything, STAFF can use the cashier.
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(60)  NOT NULL,
  username      VARCHAR(40)  NOT NULL,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL CHECK (role IN ('OWNER', 'STAFF')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_pending    BOOLEAN      NOT NULL DEFAULT FALSE, -- signed up, waiting for owner approval
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_username_unique ON users (lower(username));

-- Sesi login. Only a hash of the token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Pengaturan toko: always exactly one row.
CREATE TABLE store_settings (
  id         BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  name       VARCHAR(60) NOT NULL DEFAULT 'UsahaCerdas',
  address    VARCHAR(200),
  phone      VARCHAR(30),
  footer     VARCHAR(200),
  logo       TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO store_settings DEFAULT VALUES;

-- Produk: nama, kategori, barcode, harga jual, modal, stok.
CREATE TABLE products (
  id         TEXT PRIMARY KEY,                  -- "PRD-<timestamp>-<random>", made by server.js
  name       VARCHAR(60)    NOT NULL,
  category   VARCHAR(40),
  barcode    VARCHAR(64),
  price      NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
  cost       NUMERIC(14, 2) NOT NULL CHECK (cost >= 0),
  stock      INTEGER        NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- lomba.js rejects duplicate names regardless of upper/lower case.
CREATE UNIQUE INDEX products_name_unique ON products (lower(name));
CREATE UNIQUE INDEX products_barcode_unique ON products (barcode) WHERE barcode IS NOT NULL;

-- Transaksi: metode bayar, diskon, uang diterima, kembalian, kasir.
-- The total is calculated from the items. A cancelled sale keeps its record.
CREATE TABLE transactions (
  id             TEXT PRIMARY KEY,              -- "TRX-<timestamp>-<random>", made by lomba.js
  date           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  payment_method VARCHAR(10)    NOT NULL DEFAULT 'TUNAI'
                 CHECK (payment_method IN ('TUNAI', 'QRIS', 'TRANSFER')),
  discount       NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  payment        NUMERIC(14, 2) NOT NULL CHECK (payment >= 0),
  change_amount  NUMERIC(14, 2) NOT NULL CHECK (change_amount >= 0),
  cashier_name   VARCHAR(60),
  cancelled_at   TIMESTAMPTZ
);

CREATE INDEX transactions_date_idx ON transactions (date);

-- Rincian transaksi. Name, price and cost are copies from the time of sale, so
-- editing or deleting a product does not change past transactions.
CREATE TABLE transaction_items (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id TEXT           NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  product_id     TEXT           REFERENCES products (id) ON DELETE SET NULL,
  name           VARCHAR(60)    NOT NULL,
  price          NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
  cost           NUMERIC(14, 2) NOT NULL CHECK (cost >= 0),
  quantity       INTEGER        NOT NULL CHECK (quantity > 0)
);

CREATE INDEX transaction_items_transaction_idx ON transaction_items (transaction_id);
CREATE INDEX transaction_items_product_idx ON transaction_items (product_id);

-- Riwayat stok: every change to a product's stock and why it happened.
CREATE TABLE stock_movements (
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

CREATE INDEX stock_movements_created_idx ON stock_movements (created_at);
CREATE INDEX stock_movements_product_idx ON stock_movements (product_id);

-- Pengeluaran usaha: sewa, listrik, gaji, dan lainnya.
CREATE TABLE expenses (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date        DATE           NOT NULL,
  category    VARCHAR(40)    NOT NULL,
  description VARCHAR(200),
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  user_name   VARCHAR(60),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX expenses_date_idx ON expenses (date);

-- Total and gross profit per transaction, matching transactionTotal() and
-- transactionProfit() in lomba.js.
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
