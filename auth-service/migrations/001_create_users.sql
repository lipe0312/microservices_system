CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  nome_completo VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  senha_hash  VARCHAR(255) NOT NULL,
  cpf         VARCHAR(14),
  tipo        VARCHAR(10) NOT NULL DEFAULT 'comum' CHECK (tipo IN ('advogado', 'comum')),
  oab_numero  VARCHAR(50),
  created_at  TIMESTAMP DEFAULT NOW()
);
