// [SOLID: SRP] — responsabilidade única: gerenciar conexão com o banco
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Evita crash do processo quando o banco cai abruptamente (evento 'error' não tratado no pool)
pool.on('error', (err) => {
  console.error('[DB] Erro no pool de conexões:', err.message);
});

module.exports = { pool };
