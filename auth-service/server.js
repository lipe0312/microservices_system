// [SOLID: DIP] — depende do módulo authService, não de implementação direta de pg/jwt
const express = require('express');
const cors = require('cors');
const authService = require('./services/authService');

const app = express();
app.use(express.json());
app.use(cors());

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

// [SOLID: SRP] — controller apenas orquestra, sem regra de negócio de login
app.post('/auth/login', async (req, res) => {
    const { email, senha, password } = req.body;
    const senhaFinal = senha || password;

    try {
        const result = await authService.login(email, senhaFinal);
        console.log(`[Auth Service] Login efetuado: ${email}`);
        res.status(200).json(result);
    } catch (err) {
        if (err.status === 401) return res.status(401).json({ error: 'Credenciais inválidas.' });
        console.error('[Auth Service] Erro no login:', err.message);
        res.status(500).json({ error: 'Erro interno ao efetuar login.' });
    }
});

app.listen(3001, () => console.log('=> Auth Service ativo na porta 3001'));
