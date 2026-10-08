const { neon } = require("@neondatabase/serverless");
let schemaPromise;

function client() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diatur.");
  return neon(process.env.DATABASE_URL);
}

async function ready(sql) {
  if (!schemaPromise) {
    schemaPromise = sql`CREATE TABLE IF NOT EXISTS cycles (
      no INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`.catch((error) => { schemaPromise = null; throw error; });
  }
  await schemaPromise;
}

async function listCycles() {
  const sql = client();
  await ready(sql);
  const rows = await sql`SELECT no, data FROM cycles ORDER BY no`;
  return rows.map(({ no, data }) => ({ ...data, no }));
}

async function addCycle(data) {
  const sql = client();
  await ready(sql);
  const rows = await sql`INSERT INTO cycles (data) VALUES (${JSON.stringify(data)}::jsonb) RETURNING no`;
  return rows[0].no;
}

module.exports = { listCycles, addCycle };
