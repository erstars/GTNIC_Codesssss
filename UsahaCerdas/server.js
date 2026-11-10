// UsahaCerdas backend: serves the website, handles login, and saves data in PostgreSQL.
// Start with: npm.cmd start   then open http://localhost:3000

const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { createHash, randomBytes, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { Pool } = require("pg");

// On a hosting service the settings come from its dashboard, so .env is optional.
if (fs.existsSync(path.join(__dirname, ".env"))) process.loadEnvFile(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT) || 3000;
// Default: only this PC. Set HOST=0.0.0.0 to allow phones on the same Wi-Fi.
const HOST = process.env.HOST || "127.0.0.1";
const SESSION_HOURS = 12;
const COOKIE_NAME = "usahacerdas_session";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const scryptAsync = promisify(scrypt);

// Only these files are served, so .env and server.js can never be downloaded.
// Each path is written out in full so hosting services (Vercel) know to ship these files.
const HTML = path.join(__dirname, "lomba.html");
const PAGES = {
  "/": [HTML, "text/html; charset=utf-8"],
  "/lomba.html": [HTML, "text/html; charset=utf-8"],
  "/lomba.css": [path.join(__dirname, "lomba.css"), "text/css; charset=utf-8"],
  "/lomba.js": [path.join(__dirname, "lomba.js"), "text/javascript; charset=utf-8"],
  "/assets/usaha-1.webp": [path.join(__dirname, "assets", "usaha-1.webp"), "image/webp"],
  "/assets/usaha-2.png": [path.join(__dirname, "assets", "usaha-2.png"), "image/png"],
  "/assets/usaha-3.webp": [path.join(__dirname, "assets", "usaha-3.webp"), "image/webp"],
  "/assets/usaha-4.jpg": [path.join(__dirname, "assets", "usaha-4.jpg"), "image/jpeg"],
  "/assets/usaha-5.jpg": [path.join(__dirname, "assets", "usaha-5.jpg"), "image/jpeg"],
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// CHECKING INPUT

function readAmount(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    throw new HttpError(400, "Periksa kembali jumlah uang.");
  }
  return text;
}

function readCount(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000_000) {
    throw new HttpError(400, "Periksa kembali jumlah barang.");
  }
  return value;
}

// Trimmed optional text: empty becomes null.
function readText(value, max, label) {
  const text = String(value ?? "").trim();
  if (text.length > max) throw new HttpError(400, `${label} terlalu panjang.`);
  return text || null;
}

function readRequired(value, max, label) {
  const text = readText(value, max, label);
  if (!text) throw new HttpError(400, `${label} wajib diisi.`);
  return text;
}

function readDate(value) {
  const text = String(value ?? "");
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, "Tanggal tidak valid.");
  }
  return text;
}

function readPassword(value) {
  const password = String(value ?? "");
  if (password.length < 8 || password.length > 128) {
    throw new HttpError(400, "Kata sandi minimal 8 karakter.");
  }
  return password;
}

function readUsername(value) {
  const username = String(value ?? "").trim();
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    throw new HttpError(400, "Nama pengguna 3-40 karakter: huruf, angka, titik, atau garis.");
  }
  return username;
}

function readProduct(body) {
  return [
    readRequired(body.name, 60, "Nama produk"),
    readText(body.category, 40, "Kategori"),
    readText(body.barcode, 64, "Barcode"),
    readAmount(body.price),
    readAmount(body.cost),
    readCount(body.stock),
  ];
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    // Browsers won't send JSON from other websites without permission, so this
    // stops another site from writing to the database through this server.
    if (!(req.headers["content-type"] || "").startsWith("application/json")) {
      reject(new HttpError(415, "Format permintaan tidak didukung."));
      return;
    }
    let text = "";
    req.on("data", (chunk) => {
      text += chunk;
      if (text.length > 400_000) reject(new HttpError(413, "Data terlalu besar."));
    });
    req.on("end", () => {
      try {
        const body = JSON.parse(text);
        if (body === null || typeof body !== "object") throw new Error("not an object");
        resolve(body);
      } catch {
        reject(new HttpError(400, "Data tidak dapat dibaca."));
      }
    });
    req.on("error", reject);
  });
}

// PASSWORDS AND LOGIN

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, SCRYPT);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password, stored) {
  const [, salt, key] = stored.split("$");
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, SCRYPT);
  return timingSafeEqual(actual, expected);
}

// Unknown usernames take as long to check as real ones, so names can't be guessed.
const decoyHash = hashPassword(randomBytes(16).toString("hex"));

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function publicUser(row) {
  return { id: row.id, name: row.name, username: row.username, role: row.role };
}

function sessionCookie(req, value, maxAge) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function readSessionToken(req) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

async function currentUser(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const result = await pool.query(
    `SELECT u.id, u.name, u.username, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
    [tokenHash(token)],
  );
  return result.rows[0] || null;
}

async function startSession(req, res, userId) {
  const token = randomBytes(32).toString("base64url");
  await pool.query("DELETE FROM sessions WHERE expires_at <= now()");
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(hours => $3))`,
    [tokenHash(token), userId, SESSION_HOURS],
  );
  res.setHeader("Set-Cookie", sessionCookie(req, token, SESSION_HOURS * 3600));
}

// Too many wrong passwords locks that username for a while.
const failedLogins = new Map();
const MAX_FAILED_LOGINS = 8;
const LOCK_MS = 15 * 60 * 1000;

function checkLoginLock(username) {
  const entry = failedLogins.get(username);
  if (!entry) return;
  if (entry.until <= Date.now()) {
    failedLogins.delete(username);
  } else if (entry.count >= MAX_FAILED_LOGINS) {
    throw new HttpError(429, "Terlalu banyak percobaan. Coba lagi 15 menit lagi.");
  }
}

function recordFailedLogin(username) {
  const entry = failedLogins.get(username) || { count: 0, until: 0 };
  entry.count += 1;
  entry.until = Date.now() + LOCK_MS;
  failedLogins.set(username, entry);
}

async function login(req, res, body) {
  const username = String(body.username ?? "").trim().toLowerCase().slice(0, 40);
  checkLoginLock(username);
  const result = await pool.query("SELECT * FROM users WHERE lower(username) = $1", [username]);
  const user = result.rows[0];
  const valid = await verifyPassword(
    String(body.password ?? "").slice(0, 128),
    user ? user.password_hash : await decoyHash,
  );
  if (!user || !valid) {
    recordFailedLogin(username);
    throw new HttpError(401, "Nama pengguna atau kata sandi salah.");
  }
  failedLogins.delete(username);
  // Only shown after the correct password, so it doesn't reveal which accounts exist.
  if (user.is_pending) throw new HttpError(403, "Akunmu masih menunggu persetujuan pemilik.");
  if (!user.is_active) throw new HttpError(403, "Akun ini dinonaktifkan. Hubungi pemilik.");
  await startSession(req, res, user.id);
  return { user: publicUser(user) };
}

// Anyone can ask for an account, but it can't log in until the owner approves it.
const REGISTER_LIMIT = 20;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
let registerCount = 0;
let registerWindowEnds = 0;

async function register(body) {
  if (Date.now() > registerWindowEnds) {
    registerCount = 0;
    registerWindowEnds = Date.now() + REGISTER_WINDOW_MS;
  }
  if (registerCount >= REGISTER_LIMIT) {
    throw new HttpError(429, "Terlalu banyak pendaftaran. Coba lagi nanti.");
  }

  const name = readRequired(body.name, 60, "Nama");
  const username = readUsername(body.username);
  const passwordHash = await hashPassword(readPassword(body.password));

  const owners = await pool.query("SELECT 1 FROM users LIMIT 1");
  if (owners.rowCount === 0) throw new HttpError(409, "Buat akun pemilik terlebih dahulu.");

  registerCount += 1;
  await pool.query(
    `INSERT INTO users (name, username, password_hash, role, is_active, is_pending)
     VALUES ($1, $2, $3, 'STAFF', FALSE, TRUE)`,
    [name, username, passwordHash],
  );
  return { ok: true };
}

async function logout(req, res) {
  const token = readSessionToken(req);
  if (token) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
  res.setHeader("Set-Cookie", sessionCookie(req, "", 0));
  return { ok: true };
}

// The very first account can be made without logging in, and becomes the owner.
async function setupOwner(req, res, body) {
  const name = readRequired(body.name, 60, "Nama");
  const username = readUsername(body.username);
  const passwordHash = await hashPassword(readPassword(body.password));

  const user = await withTransaction(async (db) => {
    await db.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const existing = await db.query("SELECT 1 FROM users LIMIT 1");
    if (existing.rowCount > 0) throw new HttpError(409, "Akun pemilik sudah dibuat.");
    const created = await db.query(
      `INSERT INTO users (name, username, password_hash, role)
       VALUES ($1, $2, $3, 'OWNER') RETURNING id, name, username, role`,
      [name, username, passwordHash],
    );
    return created.rows[0];
  });
  await startSession(req, res, user.id);
  return { user: publicUser(user) };
}

async function changeOwnPassword(req, res, user, body) {
  const stored = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  const valid = await verifyPassword(
    String(body.currentPassword ?? "").slice(0, 128),
    stored.rows[0].password_hash,
  );
  if (!valid) throw new HttpError(400, "Kata sandi saat ini salah.");
  const passwordHash = await hashPassword(readPassword(body.newPassword));
  await pool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [user.id, passwordHash]);
  // Logs out every other device, and keeps this one logged in.
  await pool.query("DELETE FROM sessions WHERE user_id = $1", [user.id]);
  await startSession(req, res, user.id);
  return { ok: true };
}

// DATABASE HELPERS

async function withTransaction(work) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const result = await work(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

function addStockMovement(db, movement) {
  return db.query(
    `INSERT INTO stock_movements
       (product_id, product_name, change, stock_after, reason, note, user_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      movement.productId,
      movement.productName,
      movement.change,
      movement.stockAfter,
      movement.reason,
      movement.note ?? null,
      movement.userName,
    ],
  );
}

// READING DATA

async function getStore() {
  const result = await pool.query("SELECT name, address, phone, footer, logo FROM store_settings");
  return result.rows[0] || { name: "UsahaCerdas" };
}

async function getSession(req) {
  const [user, users, store] = await Promise.all([
    currentUser(req),
    pool.query("SELECT 1 FROM users LIMIT 1"),
    getStore(),
  ]);
  return { setupRequired: users.rowCount === 0, user: user && publicUser(user), store };
}

// Staff never receive cost prices, profit, expenses or stock history.
async function getData(user) {
  const owner = user.role === "OWNER";
  const products = await pool.query(
    `SELECT id, name, category, barcode, price::float8 AS price,
            ${owner ? "cost::float8" : "NULL"} AS cost, stock
     FROM products ORDER BY lower(name)`,
  );
  const transactions = await pool.query(
    `SELECT t.id, t.date, t.payment::float8 AS payment, t.change_amount::float8 AS change,
            t.payment_method AS "paymentMethod", t.discount::float8 AS discount,
            t.cashier_name AS "cashierName", t.cancelled_at AS "cancelledAt",
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', i.product_id, 'name', i.name, 'price', i.price,
                  'cost', ${owner ? "i.cost" : "NULL"}, 'quantity', i.quantity
                ) ORDER BY i.id
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'
            ) AS items
     FROM transactions t
     LEFT JOIN transaction_items i ON i.transaction_id = t.id
     GROUP BY t.id
     ORDER BY t.date, t.id`,
  );
  const expenses = owner
    ? await pool.query(
        `SELECT id, date::text AS date, category, description, amount::float8 AS amount,
                user_name AS "userName"
         FROM expenses ORDER BY date, id`,
      )
    : { rows: [] };
  const pending = owner
    ? await pool.query("SELECT count(*)::int AS count FROM users WHERE is_pending")
    : { rows: [{ count: 0 }] };

  return {
    products: products.rows,
    transactions: transactions.rows,
    expenses: expenses.rows,
    pendingAccounts: pending.rows[0].count,
    store: await getStore(),
  };
}

async function getStockMovements(url) {
  const productId = url.searchParams.get("productId");
  const result = await pool.query(
    `SELECT id, product_id AS "productId", product_name AS "productName", change,
            stock_after AS "stockAfter", reason, note, user_name AS "userName",
            created_at AS "createdAt"
     FROM stock_movements
     WHERE $1::text IS NULL OR product_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 200`,
    [productId],
  );
  return { movements: result.rows };
}

// PRODUCTS

async function addProduct(user, body) {
  const id = `PRD-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const product = readProduct(body);
  await withTransaction(async (db) => {
    await db.query(
      `INSERT INTO products (id, name, category, barcode, price, cost, stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, ...product],
    );
    const stock = product[5];
    if (stock > 0) {
      await addStockMovement(db, {
        productId: id,
        productName: product[0],
        change: stock,
        stockAfter: stock,
        reason: "AWAL",
        userName: user.name,
      });
    }
  });
  return { id };
}

async function updateProduct(user, id, body) {
  const product = readProduct(body);
  await withTransaction(async (db) => {
    const current = await db.query("SELECT stock FROM products WHERE id = $1 FOR UPDATE", [id]);
    if (current.rowCount === 0) throw new HttpError(404, "Produk tidak ditemukan.");
    await db.query(
      `UPDATE products
       SET name = $2, category = $3, barcode = $4, price = $5, cost = $6, stock = $7,
           updated_at = now()
       WHERE id = $1`,
      [id, ...product],
    );
    const stock = product[5];
    const change = stock - current.rows[0].stock;
    if (change !== 0) {
      await addStockMovement(db, {
        productId: id,
        productName: product[0],
        change,
        stockAfter: stock,
        reason: "KOREKSI",
        userName: user.name,
      });
    }
  });
  return { id };
}

async function restockProduct(user, id, body) {
  const quantity = readCount(body.quantity);
  if (quantity === 0) throw new HttpError(400, "Jumlah restok harus lebih dari 0.");
  const note = readText(body.note, 200, "Catatan");
  await withTransaction(async (db) => {
    const updated = await db.query(
      `UPDATE products SET stock = stock + $2, updated_at = now()
       WHERE id = $1 RETURNING name, stock`,
      [id, quantity],
    );
    if (updated.rowCount === 0) throw new HttpError(404, "Produk tidak ditemukan.");
    await addStockMovement(db, {
      productId: id,
      productName: updated.rows[0].name,
      change: quantity,
      stockAfter: updated.rows[0].stock,
      reason: "RESTOK",
      note,
      userName: user.name,
    });
  });
  return { id };
}

async function deleteProduct(id) {
  const result = await pool.query("DELETE FROM products WHERE id = $1", [id]);
  if (result.rowCount === 0) throw new HttpError(404, "Produk tidak ditemukan.");
  return { id };
}

// SALES

// Prices and stock come from the database, never from the browser. All of the
// sale is saved together, or none of it is.
async function completeSale(user, body) {
  const id = String(body.id ?? "");
  if (!/^TRX-[\w-]{1,60}$/.test(id)) throw new HttpError(400, "ID transaksi tidak valid.");
  const method = String(body.paymentMethod ?? "TUNAI");
  if (!["TUNAI", "QRIS", "TRANSFER"].includes(method)) {
    throw new HttpError(400, "Metode pembayaran tidak valid.");
  }
  const discount = readAmount(body.discount ?? 0);
  // Only cash has an amount handed over. QRIS and transfer pay the exact total.
  const cashReceived = method === "TUNAI" ? readAmount(body.payment) : null;

  const quantities = new Map();
  for (const item of Array.isArray(body.items) ? body.items : []) {
    const quantity = readCount(item.quantity);
    if (quantity === 0) throw new HttpError(400, "Periksa kembali jumlah barang.");
    const productId = String(item.productId);
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  if (quantities.size === 0) throw new HttpError(400, "Keranjang masih kosong.");
  const ids = [...quantities.keys()];
  const counts = [...quantities.values()];

  try {
    return await withTransaction(async (db) => {
      // The same sale sent twice (double click, retry) is only saved once.
      const existing = await db.query("SELECT 1 FROM transactions WHERE id = $1", [id]);
      if (existing.rowCount > 0) return { id };

      // Locks these products until the sale finishes, so stock can't be oversold.
      const products = await db.query(
        "SELECT id, name, stock FROM products WHERE id = ANY($1) ORDER BY id FOR UPDATE",
        [ids],
      );
      if (products.rowCount !== ids.length) {
        throw new HttpError(409, "Produk tidak tersedia. Periksa keranjang.");
      }
      for (const product of products.rows) {
        if (product.stock < quantities.get(product.id)) {
          throw new HttpError(409, `Stok ${product.name} tidak mencukupi.`);
        }
      }

      const sum = await db.query(
        `SELECT total,
                COALESCE($4::numeric, total) AS payment,
                COALESCE($4::numeric, total) - total AS change
         FROM (
           SELECT SUM(p.price * x.quantity) - $3::numeric AS total
           FROM unnest($1::text[], $2::int[]) AS x(id, quantity)
           JOIN products p ON p.id = x.id
         ) AS cart`,
        [ids, counts, discount, cashReceived],
      );
      const { total, payment, change } = sum.rows[0];
      if (Number(total) < 0) throw new HttpError(400, "Diskon melebihi total belanja.");
      if (Number(change) < 0) throw new HttpError(400, "Uang yang diterima belum mencukupi.");

      await db.query(
        `INSERT INTO transactions
           (id, payment_method, discount, payment, change_amount, cashier_name)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, method, discount, payment, change, user.name],
      );
      await db.query(
        `INSERT INTO transaction_items (transaction_id, product_id, name, price, cost, quantity)
         SELECT $3, p.id, p.name, p.price, p.cost, x.quantity
         FROM unnest($1::text[], $2::int[]) AS x(id, quantity)
         JOIN products p ON p.id = x.id`,
        [ids, counts, id],
      );
      await db.query(
        `WITH updated AS (
           UPDATE products p SET stock = p.stock - x.quantity, updated_at = now()
           FROM unnest($1::text[], $2::int[]) AS x(id, quantity)
           WHERE p.id = x.id
           RETURNING p.id, p.name, p.stock, x.quantity
         )
         INSERT INTO stock_movements
           (product_id, product_name, change, stock_after, reason, transaction_id, user_name)
         SELECT id, name, -quantity, stock, 'JUAL', $3, $4 FROM updated`,
        [ids, counts, id, user.name],
      );
      return { id };
    });
  } catch (error) {
    if (error.constraint === "transactions_pkey") return { id }; // saved by a simultaneous request
    throw error;
  }
}

// Keeps the record but leaves it out of all totals, and returns the stock.
// Products deleted since the sale have nothing to return to.
async function cancelSale(user, id) {
  return withTransaction(async (db) => {
    const sale = await db.query("SELECT cancelled_at FROM transactions WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (sale.rowCount === 0) throw new HttpError(404, "Transaksi tidak ditemukan.");
    if (sale.rows[0].cancelled_at) throw new HttpError(409, "Transaksi sudah dibatalkan.");

    await db.query(
      `WITH updated AS (
         UPDATE products p SET stock = p.stock + i.quantity, updated_at = now()
         FROM transaction_items i
         WHERE i.transaction_id = $1 AND i.product_id = p.id
         RETURNING p.id, p.name, p.stock, i.quantity
       )
       INSERT INTO stock_movements
         (product_id, product_name, change, stock_after, reason, transaction_id, user_name)
       SELECT id, name, quantity, stock, 'BATAL', $1, $2 FROM updated`,
      [id, user.name],
    );
    await db.query("UPDATE transactions SET cancelled_at = now() WHERE id = $1", [id]);
    return { id };
  });
}

// Only transactions are removed. Products and stock stay.
async function clearTransactions() {
  await pool.query("DELETE FROM transactions");
  return { ok: true };
}

// EXPENSES

async function addExpense(user, body) {
  const amount = readAmount(body.amount);
  if (Number(amount) <= 0) throw new HttpError(400, "Jumlah pengeluaran harus lebih dari 0.");
  const result = await pool.query(
    `INSERT INTO expenses (date, category, description, amount, user_name)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      readDate(body.date),
      readRequired(body.category, 40, "Kategori"),
      readText(body.description, 200, "Keterangan"),
      amount,
      user.name,
    ],
  );
  return { id: result.rows[0].id };
}

async function deleteExpense(id) {
  if (!/^\d{1,18}$/.test(id)) throw new HttpError(404, "Pengeluaran tidak ditemukan.");
  const result = await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
  if (result.rowCount === 0) throw new HttpError(404, "Pengeluaran tidak ditemukan.");
  return { id };
}

// STORE SETTINGS

async function updateStore(body) {
  const logo = body.logo ? String(body.logo) : null;
  if (logo && (logo.length > 300_000 || !/^data:image\/(png|jpeg);base64,[\w+/=]+$/.test(logo))) {
    throw new HttpError(400, "Logo tidak valid.");
  }
  await pool.query(
    `UPDATE store_settings
     SET name = $1, address = $2, phone = $3, footer = $4, logo = $5, updated_at = now()`,
    [
      readRequired(body.name, 60, "Nama toko"),
      readText(body.address, 200, "Alamat"),
      readText(body.phone, 30, "Telepon"),
      readText(body.footer, 200, "Catatan struk"),
      logo,
    ],
  );
  return getStore();
}

// TEAM ACCOUNTS

async function listUsers() {
  const result = await pool.query(
    `SELECT id, name, username, role, is_active AS "isActive", is_pending AS "isPending",
            created_at AS "createdAt"
     FROM users ORDER BY is_pending DESC, created_at, id`,
  );
  return { users: result.rows };
}

function readRole(value) {
  if (value !== "OWNER" && value !== "STAFF") throw new HttpError(400, "Peran tidak valid.");
  return value;
}

async function addUser(body) {
  const passwordHash = await hashPassword(readPassword(body.password));
  const result = await pool.query(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [
      readRequired(body.name, 60, "Nama"),
      readUsername(body.username),
      passwordHash,
      readRole(body.role),
    ],
  );
  return { id: result.rows[0].id };
}

async function updateUser(currentAdmin, id, body) {
  if (!/^\d{1,18}$/.test(id)) throw new HttpError(404, "Akun tidak ditemukan.");
  const role = readRole(body.role);
  const isActive = Boolean(body.isActive);
  const passwordHash = body.password ? await hashPassword(readPassword(body.password)) : null;

  await withTransaction(async (db) => {
    await db.query("LOCK TABLE users IN EXCLUSIVE MODE");
    const found = await db.query("SELECT id FROM users WHERE id = $1", [id]);
    if (found.rowCount === 0) throw new HttpError(404, "Akun tidak ditemukan.");
    if (String(currentAdmin.id) === id && (!isActive || role !== "OWNER")) {
      throw new HttpError(400, "Kamu tidak bisa menonaktifkan atau menurunkan akunmu sendiri.");
    }
    await db.query(
      `UPDATE users
       SET role = $2, is_active = $3, password_hash = COALESCE($4, password_hash),
           is_pending = is_pending AND NOT $3
       WHERE id = $1`,
      [id, role, isActive, passwordHash],
    );
    // A disabled account or changed password must log in again.
    if (!isActive || passwordHash) {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }
  });
  return { id };
}

// Only sign-up requests can be removed. Real accounts are deactivated instead.
async function rejectRequest(id) {
  if (!/^\d{1,18}$/.test(id)) throw new HttpError(404, "Akun tidak ditemukan.");
  const result = await pool.query("DELETE FROM users WHERE id = $1 AND is_pending", [id]);
  if (result.rowCount === 0) throw new HttpError(404, "Permintaan akun tidak ditemukan.");
  return { id };
}

// ROUTES

function requireUser(user) {
  if (!user) throw new HttpError(401, "Silakan masuk terlebih dahulu.");
  return user;
}

function requireOwner(user) {
  requireUser(user);
  if (user.role !== "OWNER") throw new HttpError(403, "Hanya pemilik yang boleh melakukan ini.");
  return user;
}

async function handleApi(req, res, url) {
  const { pathname } = url;
  const method = req.method;

  // No login needed.
  if (method === "GET" && pathname === "/api/session") return getSession(req);
  if (method === "POST" && pathname === "/api/login") return login(req, res, await readBody(req));
  if (method === "POST" && pathname === "/api/setup") {
    return setupOwner(req, res, await readBody(req));
  }
  if (method === "POST" && pathname === "/api/register") return register(await readBody(req));
  if (method === "POST" && pathname === "/api/logout") return logout(req, res);

  // Everything below needs a logged-in user.
  const user = requireUser(await currentUser(req));
  const part = (pattern) => {
    const match = pathname.match(pattern);
    return match && decodeURIComponent(match[1]);
  };
  const productId = part(/^\/api\/products\/([^/]+)$/);
  const restockId = part(/^\/api\/products\/([^/]+)\/restock$/);
  const cancelId = part(/^\/api\/transactions\/([^/]+)\/cancel$/);
  const expenseId = part(/^\/api\/expenses\/([^/]+)$/);
  const userId = part(/^\/api\/users\/([^/]+)$/);

  if (method === "GET" && pathname === "/api/data") return getData(user);
  if (method === "POST" && pathname === "/api/sales") {
    return completeSale(user, await readBody(req));
  }
  if (method === "POST" && pathname === "/api/password") {
    return changeOwnPassword(req, res, user, await readBody(req));
  }

  // Owner only.
  if (method === "POST" && pathname === "/api/products") {
    return addProduct(requireOwner(user), await readBody(req));
  }
  if (method === "PUT" && productId) {
    return updateProduct(requireOwner(user), productId, await readBody(req));
  }
  if (method === "DELETE" && productId) {
    requireOwner(user);
    return deleteProduct(productId);
  }
  if (method === "POST" && restockId) {
    return restockProduct(requireOwner(user), restockId, await readBody(req));
  }
  if (method === "GET" && pathname === "/api/stock-movements") {
    requireOwner(user);
    return getStockMovements(url);
  }
  if (method === "POST" && cancelId) {
    requireOwner(user);
    await readBody(req);
    return cancelSale(user, cancelId);
  }
  if (method === "DELETE" && pathname === "/api/transactions") {
    requireOwner(user);
    return clearTransactions();
  }
  if (method === "POST" && pathname === "/api/expenses") {
    return addExpense(requireOwner(user), await readBody(req));
  }
  if (method === "DELETE" && expenseId) {
    requireOwner(user);
    return deleteExpense(expenseId);
  }
  if (method === "PUT" && pathname === "/api/settings") {
    requireOwner(user);
    return updateStore(await readBody(req));
  }
  if (method === "GET" && pathname === "/api/users") {
    requireOwner(user);
    return listUsers();
  }
  if (method === "POST" && pathname === "/api/users") {
    requireOwner(user);
    return addUser(await readBody(req));
  }
  if (method === "PUT" && userId) {
    return updateUser(requireOwner(user), userId, await readBody(req));
  }
  if (method === "DELETE" && userId) {
    requireOwner(user);
    return rejectRequest(userId);
  }

  throw new HttpError(404, "Alamat tidak ditemukan.");
}

function sendJson(res, status, value) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

const DUPLICATE_MESSAGES = {
  products_name_unique: "Nama produk sudah digunakan.",
  products_barcode_unique: "Barcode sudah dipakai produk lain.",
  users_username_unique: "Nama pengguna sudah dipakai.",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    try {
      sendJson(res, 200, await handleApi(req, res, url));
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message });
      } else if (error.code === "23505") {
        const message = DUPLICATE_MESSAGES[error.constraint] || "Data sudah ada.";
        sendJson(res, 409, { error: message });
      } else if (["23514", "22003", "22P02", "22008"].includes(error.code)) {
        sendJson(res, 400, { error: "Periksa kembali data yang dimasukkan." });
      } else {
        console.error(error);
        sendJson(res, 500, { error: "Terjadi masalah pada server." });
      }
    }
    return;
  }

  const page = PAGES[url.pathname];
  if (req.method !== "GET" || !page) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Halaman tidak ditemukan.");
    return;
  }
  fs.readFile(page[0], (error, content) => {
    if (error) {
      console.error("Cannot read", page[0], error.message);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Terjadi masalah pada server.");
      return;
    }
    res.writeHead(200, {
      "Content-Type": page[1],
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(content);
  });
});

// On Vercel each request is handed to the exported function; everywhere else we listen on a port.
module.exports = (req, res) => server.emit("request", req, res);

if (!process.env.VERCEL) {
  server.listen(PORT, HOST, () => {
    console.log(`UsahaCerdas berjalan di http://localhost:${PORT}`);

    if (HOST !== "127.0.0.1") {
      for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses) {
          if (address.family === "IPv4" && !address.internal) {
            console.log(`Dari HP di Wi-Fi yang sama: http://${address.address}:${PORT}`);
          }
        }
      }
    }
  });
}
