CREATE TABLE IF NOT EXISTS credit_packages (
  id                  SERIAL PRIMARY KEY,
  nome                VARCHAR(255) UNIQUE NOT NULL,
  quantidade_creditos INTEGER NOT NULL,
  valor_por_credito   NUMERIC(10,2) NOT NULL,
  descricao_beneficios TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  package_id   INTEGER REFERENCES credit_packages(id),
  billing_data JSONB,
  pix_code     TEXT,
  status       VARCHAR(50) DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT NOW()
);

INSERT INTO credit_packages (id, nome, quantidade_creditos, valor_por_credito, descricao_beneficios)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'Básico',   10,  5.00, 'Ideal para uso ocasional'),
  (2, 'Médio',    50,  4.00, 'Melhor custo-benefício'),
  (3, 'Premium', 150,  3.00, 'Para uso intensivo')
ON CONFLICT (id) DO NOTHING;
