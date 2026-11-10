// Fills an EMPTY database with sample products, sales and expenses for demonstrations.
// Run with: npm.cmd run demo
// It refuses to run if products or transactions already exist, so real data is safe.

const path = require("node:path");
const { Pool } = require("pg");

process.loadEnvFile(path.join(__dirname, "..", ".env"));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PRODUCTS = [
  ["Nasi goreng spesial", "Makanan", "8990001000011", 28000, 16000, 60],
  ["Mie ayam bakso", "Makanan", "8990001000028", 25000, 14000, 45],
  ["Ayam geprek", "Makanan", "8990001000035", 22000, 12000, 40],
  ["Soto ayam", "Makanan", "8990001000042", 20000, 11000, 4],
  ["Es teh manis", "Minuman", "8990001000059", 6000, 2000, 120],
  ["Kopi susu gula aren", "Minuman", "8990001000066", 18000, 8000, 70],
  ["Jus alpukat", "Minuman", "8990001000073", 15000, 8000, 3],
  ["Pisang goreng", "Camilan", "8990001000080", 12000, 5000, 35],
  ["Kerupuk udang", "Camilan", "8990001000097", 8000, 3000, 0],
];

const EXPENSES = [
  [27, "Sewa", "Sewa kios bulan ini", 800000],
  [20, "Listrik", "Token listrik", 150000],
  [14, "Transportasi", "Bensin antar pesanan", 120000],
  [7, "Internet", "Paket internet kios", 100000],
  [3, "Gaji", "Upah harian karyawan", 400000],
  [1, "Lainnya", "Plastik dan tisu", 75000],
];

// Same numbers every run, so a demo always looks the same.
let seed = 42;
const random = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;

async function main() {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    const counts = await db.query(
      "SELECT (SELECT count(*) FROM products) AS products, (SELECT count(*) FROM transactions) AS sales",
    );
    if (Number(counts.rows[0].products) > 0 || Number(counts.rows[0].sales) > 0) {
      console.log("Dibatalkan: database sudah berisi data. Data demo hanya untuk database kosong.");
      await db.query("ROLLBACK");
      return;
    }

    const products = [];
    for (const [index, row] of PRODUCTS.entries()) {
      const id = `PRD-DEMO-${index + 1}`;
      await db.query(
        `INSERT INTO products (id, name, category, barcode, price, cost, stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, ...row],
      );
      await db.query(
        `INSERT INTO stock_movements (product_id, product_name, change, stock_after, reason, user_name)
         SELECT $1, $2, $3, $3, 'AWAL', 'Demo' WHERE $3::int <> 0`,
        [id, row[0], row[5]],
      );
      products.push({ id, name: row[0], price: row[3], cost: row[4] });
    }

    // Sample sales do not reduce stock, so the demo keeps its low-stock examples.
    const sellable = products.filter((product) => product.name !== "Kerupuk udang");
    let count = 0;
    for (let daysAgo = 20; daysAgo >= 0; daysAgo--) {
      const salesToday = 4 + Math.floor(random() * 6);
      for (let n = 0; n < salesToday; n++) {
        const lines = new Map();
        const lineCount = 1 + Math.floor(random() * 3);
        for (let l = 0; l < lineCount; l++) {
          const product = sellable[Math.floor(random() * sellable.length)];
          lines.set(product, (lines.get(product) || 0) + 1 + Math.floor(random() * 2));
        }

        let subtotal = 0;
        for (const [product, quantity] of lines) subtotal += product.price * quantity;

        const roll = random();
        const method = roll < 0.55 ? "TUNAI" : roll < 0.85 ? "QRIS" : "TRANSFER";
        const discount = random() < 0.12 ? 5000 : 0;
        const total = Math.max(0, subtotal - discount);
        const payment = method === "TUNAI" ? Math.ceil(total / 10000) * 10000 : total;

        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        date.setHours(8 + Math.floor(random() * 12), Math.floor(random() * 60), 0, 0);
        if (date > new Date()) date.setTime(Date.now() - (n + 1) * 60000);

        const id = `TRX-DEMO-${++count}`;
        await db.query(
          `INSERT INTO transactions (id, date, payment_method, discount, payment, change_amount, cashier_name)
           VALUES ($1, $2, $3, $4, $5, $6, 'Demo')`,
          [id, date, method, discount, payment, payment - total],
        );
        for (const [product, quantity] of lines) {
          await db.query(
            `INSERT INTO transaction_items (transaction_id, product_id, name, price, cost, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id, product.id, product.name, product.price, product.cost, quantity],
          );
        }
      }
    }

    for (const [daysAgo, category, description, amount] of EXPENSES) {
      await db.query(
        `INSERT INTO expenses (date, category, description, amount, user_name)
         VALUES (CURRENT_DATE - $1::int, $2, $3, $4, 'Demo')`,
        [daysAgo, category, description, amount],
      );
    }

    await db.query("COMMIT");
    console.log(`Selesai: ${products.length} produk, ${count} transaksi, ${EXPENSES.length} pengeluaran.`);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
