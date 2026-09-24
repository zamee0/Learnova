const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

// Keep every standalone write in an explicit transaction. Multi-step workflows
// that need one atomic unit use a checked-out client and manage it themselves.
const query = pool.query.bind(pool);
pool.query = async (text, values) => {
  const sql = typeof text === "string" ? text : text?.text;
  if (!/^\s*(INSERT|UPDATE|DELETE|MERGE|CALL)\b/i.test(sql || "")) {
    return query(text, values);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(text, values);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw err;
  } finally {
    client.release();
  }
};

pool.withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await work(client);
    await client.query("COMMIT");
    return value;
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    throw err;
  } finally {
    client.release();
  }
};

pool.on("connect", () => {
  console.log("Connected to PostgreSQL database successfully.");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle database client:", err);
  process.exit(-1);
});

module.exports = pool;
