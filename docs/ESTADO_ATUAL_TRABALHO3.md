# ESTADO_ATUAL — Trabalho III (Veridit) · Eng. Software I / BCC-UFBA

> Gerado em: 2026-06-07  
> Branch: `refactor/t3-alinhamento-grupo2`  
> Repositório: `microservices_system`  
> Estado: **FINAL** — todas as fases do PLAN.md concluídas

---

## 1. Raio-X da Implementação Atual

### 1.1 Mapeamento de Arquivos → Componentes

**auth-service** — Microsserviço de Autenticação (porta interna 3001)

| Arquivo | Papel |
|---------|-------|
| `auth-service/server.js` | Roteamento HTTP; controllers de `/auth/register` e `/auth/login` |
| `auth-service/services/authService.js` | Regras de negócio: `register()` e `login()` |
| `auth-service/repositories/userRepository.js` | Acesso SQL à tabela `users` (`createUser`, `findByEmail`) |
| `auth-service/db.js` | Pool de conexão PostgreSQL via variáveis de ambiente |
| `auth-service/migrations/001_create_users.sql` | Schema da tabela `users` com campos do Apêndice A |
| `auth-service/entrypoint.sh` | Aguarda PostgreSQL (pg_isready) e executa migration antes de subir |
| `auth-service/Dockerfile` | Node 18-alpine; entrypoint configurado |
| `auth-service/package.json` | Dependências: express, cors, pg, bcrypt, jsonwebtoken |

**payment-service** — Microsserviço de Pagamentos (porta interna 3002)

| Arquivo | Papel |
|---------|-------|
| `payment-service/server.js` | Roteamento HTTP; controllers de `/payments/packages`, `/payments/checkout` e `/payments/purchases/:id` |
| `payment-service/services/paymentService.js` | Regras de negócio: `listPackages()` e `initiatePurchase()` |
| `payment-service/services/pixService.js` | Geração de código PIX simulado no formato EMV |
| `payment-service/repositories/packageRepository.js` | Acesso SQL à tabela `credit_packages` |
| `payment-service/repositories/purchaseRepository.js` | Acesso SQL à tabela `purchases` |
| `payment-service/db.js` | Pool de conexão PostgreSQL via variáveis de ambiente |
| `payment-service/middlewares/auth.js` | Middleware JWT: valida `Authorization: Bearer <token>` localmente |
| `payment-service/messaging/publisher.js` | Publica eventos no exchange `payment_events` (RabbitMQ) |
| `payment-service/resilience/circuitBreaker.js` | Circuit breaker via `opossum` para chamadas ao banco |
| `payment-service/migrations/001_create_tables.sql` | Schema de `credit_packages` e `purchases` + seed dos 3 pacotes |
| `payment-service/entrypoint.sh` | Aguarda PostgreSQL e executa migration antes de subir |
| `payment-service/Dockerfile` | Node 18-alpine com postgresql-client |
| `payment-service/package.json` | Dependências: express, cors, pg, jsonwebtoken, opossum, amqplib |

**notification-service** — Consumidor de Eventos (sem porta exposta ao host)

| Arquivo | Papel |
|---------|-------|
| `notification-service/index.js` | Conecta ao RabbitMQ (retry 10x/5s); consome `payment.confirmed`; loga confirmação de email; DLX/DLQ configurados |
| `notification-service/Dockerfile` | Node 18-alpine |
| `notification-service/package.json` | Dependência: amqplib |

**gateway** — API Gateway (nginx, porta host 80)

| Arquivo | Papel |
|---------|-------|
| `gateway/nginx.conf` | Proxy reverso: `/api/auth/*` → auth-service, `/api/payments/*` → payment-service, `/` → frontend estático |

**frontend** — Interface Web (HTML/CSS/JS puro, servida pelo gateway)

| Arquivo | Papel |
|---------|-------|
| `frontend/login.html` | Tela de login; usa `AUTH_BASE = '/api/auth'` |
| `frontend/cadastro.html` | Formulário de cadastro; usa `AUTH_BASE = '/api/auth'` |
| `frontend/creditos.html` | Catálogo de pacotes visual; logout client-side |
| `frontend/checkout.html` | Checkout com fetch real ao backend; usa `PAYMENTS_BASE = '/api/payments'` |

**Infraestrutura**

| Arquivo | Papel |
|---------|-------|
| `docker-compose.yml` | Orquestra 7 containers: gateway, auth-service, payment-service, notification-service, rabbitmq, db_auth, db_payments |

---

### 1.2 Stack Tecnológica

- **Runtime:** Node.js 18 (LTS)
- **Framework HTTP:** Express.js 4.x
- **Auth:** bcrypt 5.x + jsonwebtoken 9.x
- **Banco de Dados:** PostgreSQL 15 — dois bancos isolados (`db_auth` e `db_payments`)
- **Message Broker:** RabbitMQ 3-management
- **Resiliência:** opossum (circuit breaker)
- **API Gateway:** nginx:alpine
- **Containerização:** Docker (node:18-alpine) + Docker Compose 3.8
- **Frontend:** HTML/CSS/JS puro, sem framework

---

### 1.3 Status por Componente

| Componente | Status | Detalhe |
|---|---|---|
| Auth Service — Registro (REQ01) | ✅ Funcional | Persiste em PostgreSQL; validação por tipo; 201/400/409 |
| Auth Service — Login (REQ03) | ✅ Funcional | JWT com `{ userId, email, tipo }`, `expiresIn: '8h'` |
| Auth Service — Logout (REQ04) | ✅ Funcional | Client-side conforme ADR-0005; token removido do localStorage |
| Auth Service — PostgreSQL | ✅ Conectado | Migration automática via `entrypoint.sh` |
| Payment Service — Catálogo (REQ05) | ✅ Funcional | `GET /api/payments/packages` retorna 3 pacotes do banco |
| Payment Service — Checkout (REQ05/REQ06) | ✅ Funcional | JWT validado; compra persistida; `pixCode` gerado |
| Payment Service — Circuit Breaker (REQ06) | ✅ Funcional | `opossum` com timeout 3s; retorna 503 quando banco indisponível |
| Notification Service — Email via RabbitMQ (REQ07) | ✅ Funcional | Consome `payment.confirmed`; loga `[EMAIL]`; DLQ ativa |
| API Gateway (nginx) | ✅ Funcional | Único ponto de entrada na porta 80; portas 3001/3002 não expostas ao host |
| Frontend — Login/Cadastro | ✅ Funcional | Mock-token removido; sem URLs hardcoded |
| Frontend — Creditos/Checkout | ✅ Funcional | Catálogo e checkout reais; PIX exibido após checkout |
| Message Broker (RabbitMQ) | ✅ Funcional | Exchange `payment_events` + DLX `payment.dlx` + DLQ `payment.confirmed.dlq` |
| Escalonamento horizontal | ⚪ Fora do escopo | Não previsto nesta sprint |

---

## 2. Aderência à Arquitetura

### 2.1 Os Desvios da ADR-0006

| Desvio | Descrição | Status |
|--------|-----------|--------|
| Desvio 1 | Mock-token no `login.html` — fallback silencioso de autenticação | ✅ Corrigido — Fase 1.1 |
| Desvio 2 | `auth-service` usando `const users = []` em memória em vez de PostgreSQL | ✅ Corrigido — Fase 1.1 |
| Desvio 3 | Frontend com URLs hardcoded `localhost:300x`; ausência de API Gateway | ✅ Corrigido — Fases 1.2 (parcial) e 4.2 (completo) |
| Desvio 4 | `checkout.html` com `alert()` sem chamar o backend | ✅ Corrigido — Fase 3.1 |
| Desvio 5 | Catálogo de pacotes no `payment-service` (sem `catalog-service` separado) | ⚠️ Aceito conscientemente — documentado na ADR-0006; justificado pelo escopo acadêmico |

### 2.2 Táticas Arquiteturais

| Tática | Status | Evidência no Código |
|--------|--------|---------------------|
| Circuit Breaker | ✅ Implementado | `payment-service/resilience/circuitBreaker.js` — opossum, timeout 3s, errorThreshold 50% |
| Dead-Letter Queue | ✅ Implementado | `notification-service/index.js` — `payment.confirmed.dlq` via `payment.dlx`; TTL 5s |
| Message Broker assíncrono | ✅ Implementado | RabbitMQ; exchange `payment_events` direct; notification-service consumidor |
| API Gateway | ✅ Implementado | `gateway/nginx.conf` — proxy único na porta 80 |
| JWT stateless | ✅ Implementado | `payment-service/middlewares/auth.js` — validação local sem chamada ao auth-service |
| Bancos isolados por serviço | ✅ Implementado | `db_auth` e `db_payments` como containers PostgreSQL independentes |
| Escalonamento horizontal | ⚪ Fora do escopo | Não previsto nesta sprint |

---

## 3. Auditoria SOLID

### Pontos onde SOLID foi aplicado no código final

| Princípio | Arquivo | Descrição |
|-----------|---------|-----------|
| SRP | `auth-service/db.js` | Gerencia exclusivamente a conexão com o banco |
| SRP | `auth-service/repositories/userRepository.js` | Encapsula todo SQL da tabela `users` |
| SRP | `auth-service/services/authService.js` | Regras de negócio de autenticação isoladas da camada HTTP |
| SRP | `auth-service/server.js` | Controllers apenas orquestram; sem lógica de negócio inline |
| SRP | `payment-service/db.js` | Gerencia exclusivamente a conexão com o banco de pagamentos |
| SRP | `payment-service/middlewares/auth.js` | Valida JWT; não conhece regras de pagamento |
| SRP | `payment-service/repositories/packageRepository.js` | Encapsula todo SQL de `credit_packages` |
| SRP | `payment-service/repositories/purchaseRepository.js` | Encapsula todo SQL de `purchases` |
| SRP | `payment-service/services/paymentService.js` | Regras de negócio de pagamento isoladas da camada HTTP |
| SRP | `payment-service/services/pixService.js` | Gera apenas o código PIX simulado |
| SRP | `payment-service/resilience/circuitBreaker.js` | Encapsula exclusivamente a lógica de circuit breaker |
| SRP | `payment-service/messaging/publisher.js` | Publica exclusivamente eventos de pagamento |
| SRP | `notification-service/index.js` | Só consome e notifica; não conhece regras de pagamento |
| OCP | `payment-service/server.js` | Middleware JWT adicionado sem modificar a lógica das rotas |
| OCP | `payment-service/services/paymentService.js` | Novo provedor substituiria apenas `pixService` |
| OCP | `payment-service/services/pixService.js` | Substituível por integração real sem alterar `paymentService` |
| OCP | `payment-service/resilience/circuitBreaker.js` | Aceita qualquer função assíncrona sem modificação |
| LSP | — | N/A: sem hierarquias de classe no projeto |
| ISP | `payment-service/repositories/` | Repositórios segregados por entidade |
| ISP | `payment-service/messaging/publisher.js` | Expõe apenas `publishPaymentConfirmed` |
| DIP | `auth-service/repositories/userRepository.js` | Depende de `db.js`, não de `pg` diretamente |
| DIP | `auth-service/server.js` | Depende de `authService`, não de `pg`/`bcrypt`/`jwt` diretamente |
| DIP | `payment-service/services/paymentService.js` | Depende de abstrações; não importa `pg`, `opossum` ou `amqplib` diretamente |

> Ver `docs/SOLID_AUDIT.md` para análise completa por princípio.

---

## 4. Requisitos Implementados

| Requisito | Descrição | Serviço | Endpoint / Mecanismo | Status |
|-----------|-----------|---------|----------------------|--------|
| REQ01 | Cadastrar Usuário | `auth-service` | `POST /api/auth/register` | ✅ |
| REQ02 | Recuperar Senha | — | Fora do escopo desta sprint | ❌ |
| REQ03 | Logar no Sistema | `auth-service` | `POST /api/auth/login` → JWT | ✅ |
| REQ04 | Sair do Sistema | Frontend | `localStorage.removeItem('veridit_token')` + redirect | ✅ |
| REQ05 | Comprar Créditos | `payment-service` | `GET /api/payments/packages` + `POST /api/payments/checkout` | ✅ |
| REQ06 | Efetuar Pagamento | `payment-service` | PIX via `pixService`; circuit breaker via `opossum` | ✅ |
| REQ07 | Confirmar por email | `notification-service` | Fila `payment.confirmed` → log `[EMAIL]` | ✅ |
| REQ08–REQ15 | Captura, mídia, relatórios | — | Fora do escopo desta sprint | ❌ |

**Taxa de entrega: 6/15 = 40% (meta era 30%)**

---

## 5. ADRs Produzidas

| ADR | Decisão | Status |
|-----|---------|--------|
| ADR-0001 | Estilo arquitetural: microsserviços com broker assíncrono | ✅ Documentada |
| ADR-0002 | Estratégia de comunicação: REST síncrono + fila assíncrona | ✅ Documentada |
| ADR-0003 | Escolha do message broker: RabbitMQ | ✅ Documentada |
| ADR-0004 | Resiliência: retry, DLQ e circuit breaker (opossum) | ✅ Documentada |
| ADR-0005 | Autenticação: JWT stateless por serviço | ✅ Documentada |
| ADR-0006 | Desvios arquiteturais (5 desvios; 4 corrigidos, 1 aceito) | ✅ Documentada |

> Ver `docs/ADRs/` para os arquivos completos.
