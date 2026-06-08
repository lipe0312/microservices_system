// [SOLID: SRP] — encapsula todo acesso SQL à tabela purchases
const { pool } = require('../db');

async function createPurchase({ userId, packageId, billingData, pixCode }) {
  const result = await pool.query(
    `INSERT INTO purchases (user_id, package_id, billing_data, pix_code, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [userId, packageId, JSON.stringify(billingData), pixCode]
  );
  return result.rows[0];
}

module.exports = { createPurchase };
