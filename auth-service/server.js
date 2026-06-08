// [SOLID: DIP] — depende do módulo db.js, não de implementação direta de pg
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { pool } = require('./db');
const authService = require('./services/authService');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_faculdade';

// [SOLID: SRP] — controller apenas orquestra, sem regra de negócio
app.post('/auth/register', async (req, res) => {
    try {
        const result = await authService.register(req.body);
        console.log(`[Auth Service] Usuário registrado: ${result.email}`);
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', ...result });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        if (err.code === 'MISSING_FIELDS') return res.status(400).json({ error: err.message });
        if (err.code === 'DUPLICATE_EMAIL') return res.status(409).json({ error: err.message });
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
