// [SOLID: SRP] — encapsula todo acesso SQL à tabela credit_packages
const { pool } = require('../db');

async function listPackages() {
  const result = await pool.query(
    'SELECT * FROM credit_packages ORDER BY valor_por_credito DESC'
  );
  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM credit_packages WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { listPackages, findById };
