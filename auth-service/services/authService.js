// [SOLID: SRP] — regra de negócio de autenticação isolada da camada HTTP
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');

async function register(userData) {
    const nome_completo = userData.nome_completo || userData.name;
    const senha = userData.senha || userData.password;
    const { email, cpf, oab_numero } = userData;
    const tipo = userData.tipo || (userData.perfil === 'Advogado' ? 'advogado' : 'comum');

    if (!['advogado', 'comum'].includes(tipo)) {
        throw { status: 400, message: "Tipo inválido. Use 'advogado' ou 'comum'." };
    }

    if (!nome_completo || !email || !senha || !cpf || !tipo) {
        const err = new Error('Campos obrigatórios: nome_completo, email, senha, cpf, tipo.');
        err.code = 'MISSING_FIELDS';
        throw err;
    }

    if (tipo === 'advogado' && !oab_numero) {
        const err = new Error('Campo oab_numero é obrigatório para advogados.');
        err.code = 'MISSING_FIELDS';
        throw err;
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
        const err = new Error('Email já cadastrado.');
        err.code = 'DUPLICATE_EMAIL';
        throw err;
    }

    const senha_hash = await bcrypt.hash(senha, 10);
    const user = await userRepository.createUser({
        nome_completo,
        email,
        senha_hash,
        cpf,
        tipo,
        oab_numero: tipo === 'advogado' ? oab_numero : null,
    });

    return { userId: user.id, email: user.email, tipo: user.tipo };
}

// [SOLID: SRP] — regra de negócio de login isolada da camada HTTP
async function login(email, senha) {
    if (!email || !senha) {
        const err = new Error('Credenciais inválidas.');
        err.status = 401;
        throw err;
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
        const err = new Error('Credenciais inválidas.');
        err.status = 401;
        throw err;
    }

    const senhaValida = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaValida) {
        const err = new Error('Credenciais inválidas.');
        err.status = 401;
        throw err;
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email, tipo: user.tipo },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    return { token, user: { nome_completo: user.nome_completo, email: user.email, tipo: user.tipo } };
}

module.exports = { register, login };
