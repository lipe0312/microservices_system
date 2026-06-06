const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); 

const JWT_SECRET = 'super_secret_key_faculdade';
const users = []; // Banco em memória temporário

app.post('/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios.' });

    const userExists = users.find(u => u.email === email);
    if (userExists) return res.status(400).json({ error: 'Usuário já cadastrado.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: users.length + 1, name, email, password: hashedPassword };
    users.push(newUser);

    console.log(`[Auth Service] Usuário registrado: ${email}`);
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId: newUser.id });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
    console.log(`[Auth Service] Login efetuado: ${email}`);
    res.json({ message: 'Login autorizado!', token, userId: user.id });
});

app.listen(3001, () => console.log('=> Auth Service ativo na porta 3001'));
