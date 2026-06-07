// [SOLID: DIP] — depende do módulo db.js, não de implementação direta de pg
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { pool } = require('./db');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_faculdade';

app.post('/auth/register', async (req, res) => {
    const { nome_completo, name, email, senha, password, cpf, tipo = 'comum', oab_numero } = req.body;
    const nomeFinal = nome_completo || name;
    const senhaFinal = senha || password;
    if (!email || !senhaFinal) return res.status(400).json({ error: 'Email e senha obrigatórios.' });

    try {
        const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'Usuário já cadastrado.' });

        const senha_hash = await bcrypt.hash(senhaFinal, 10);
        const result = await pool.query(
            'INSERT INTO users (nome_completo, email, senha_hash, cpf, tipo, oab_numero) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [nomeFinal || email.split('@')[0], email, senha_hash, cpf || null, tipo, oab_numero || null]
        );

        const newId = result.rows[0].id;
        console.log(`[Auth Service] Usuário registrado: ${email}`);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId: newId });
    } catch (err) {
        console.error('[Auth Service] Erro no registro:', err.message);
        res.status(500).json({ error: 'Erro interno ao cadastrar usuário.' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { email, senha, password } = req.body;
    const senhaFinal = senha || password;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(senhaFinal, user.senha_hash))) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email, tipo: user.tipo }, JWT_SECRET, { expiresIn: '1h' });
        console.log(`[Auth Service] Login efetuado: ${email}`);
        res.json({ message: 'Login autorizado!', token, userId: user.id, name: user.nome_completo });
    } catch (err) {
        console.error('[Auth Service] Erro no login:', err.message);
        res.status(500).json({ error: 'Erro interno ao efetuar login.' });
    }
});

app.listen(3001, () => console.log('=> Auth Service ativo na porta 3001'));
