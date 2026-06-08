// [SOLID: SRP] — encapsula todo acesso SQL à tabela users
// [SOLID: DIP] — depende do módulo db.js, não de pg diretamente
const { pool } = require('../db');

async function createUser(data) {
    const { nome_completo, email, senha_hash, cpf, tipo, oab_numero } = data;
    const result = await pool.query(
        `INSERT INTO users (nome_completo, email, senha_hash, cpf, tipo, oab_numero)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nome_completo, email, cpf, tipo, oab_numero, created_at`,
        [nome_completo, email, senha_hash, cpf || null, tipo, oab_numero || null]
    );
    return result.rows[0];
}

async function findByEmail(email) {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
}

module.exports = { createUser, findByEmail };
