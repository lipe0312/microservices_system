// [SOLID: SRP] — regra de negócio de registro isolada da camada HTTP
const bcrypt = require('bcrypt');
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

module.exports = { register };
