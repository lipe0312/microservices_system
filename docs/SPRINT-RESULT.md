# SPRINT-RESULT.md — Veridit | Resultado das Fases de Implementação

> Disciplina: Engenharia de Software I — Prof. Dr. Eduardo Almeida  
> Trabalho III | Repositório: `microservices_system`  
> Branch: `refactor/t3-alinhamento-grupo2`  
> Gerado em: 2026-06-07

---

## Sprint 1 — Quitação da Dívida Técnica (ADR-0006)

> Objetivo: corrigir os 4 desvios documentados na ADR-0006 antes de qualquer feature nova. Nenhum requisito entregue nesta sprint.

---

### Fase 1.1 — Remover mock-token e conectar auth-service ao PostgreSQL

**Status:** ✅ Concluída

**Arquivos criados:**
- `auth-service/db.js` — módulo de conexão PostgreSQL via variáveis de ambiente
- `auth-service/migrations/001_create_users.sql` — tabela `users` com campos do Apêndice A

**Arquivos editados:**
- `frontend/login.html` — bloco `catch` com mock-token removido; substituído por mensagem de erro ao usuário
- `auth-service/server.js` — array `users = []` substituído por queries SQL com `pg` e `bcrypt`
- `auth-service/package.json` — dependências `pg` e `bcrypt` adicionadas
- `docker-compose.yml` — variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` e `JWT_SECRET` injetadas no auth-service

**ADRs aplicadas:** ADR-0005 (JWT stateless), ADR-0006 Desvio 1, ADR-0006 Desvio 2

**Princípios SOLID documentados:**
- `auth-service/db.js` — **SRP**: responsabilidade única de gerenciar conexão com o banco
- `auth-service/server.js` — **DIP**: depende do módulo `authService`, não de implementação direta de `pg`/`jwt`

**Desvios corrigidos:** Desvio 1 (mock-token no login.html) e Desvio 2 (persistência em memória no auth-service) integralmente corrigidos.

---

### Fase 1.2 — Adicionar validação JWT no payment-service

**Status:** ✅ Concluída

**Arquivos criados:**
- `payment-service/middlewares/auth.js` — middleware Express que valida `Authorization: Bearer <token>` localmente

**Arquivos editados:**
- `payment-service/server.js` — middleware JWT aplicado na rota `POST /payments/checkout`
- `payment-service/package.json` — dependência `jsonwebtoken` adicionada
- `docker-compose.yml` — `JWT_SECRET` adicionado ao `payment-service`

**ADRs aplicadas:** ADR-0005 (JWT stateless sem chamada HTTP ao auth-service), ADR-0006 Desvio 3 (parcial)

**Princípios SOLID documentados:**
- `payment-service/middlewares/auth.js` — **SRP**: só valida token, não conhece regras de pagamento
- `payment-service/server.js` — **OCP**: proteção adicionada via middleware sem modificar a lógica das rotas

**Desvios corrigidos:** Desvio 3 (endpoint de checkout sem autenticação) parcialmente corrigido; URL hardcoded permanece até Fase 4.2.

---

## Sprint 2 — Domínio de Autenticação (REQ01, REQ03, REQ04)

> Objetivo: cadastro, login e logout funcionando de ponta a ponta.

---

### Fase 2.1 — REQ01: Cadastro de Usuário

**Status:** ✅ Concluída

**Arquivos criados:**
- `auth-service/repositories/userRepository.js` — funções `createUser(data)` e `findByEmail(email)`; encapsula todo SQL da tabela `users`
- `auth-service/services/authService.js` — função `register(userData)` com validação de campos por tipo de usuário
- `auth-service/entrypoint.sh` — aguarda PostgreSQL e executa migration antes de subir o servidor

**Arquivos editados:**
- `auth-service/server.js` — rota `POST /auth/register` delega para `authService.register()`; trata 400, 409 e 500
- `auth-service/Dockerfile` — entrypoint configurado para `entrypoint.sh`
- `frontend/cadastro.html` — constante `API_BASE` adicionada; URLs hardcoded removidas

**ADRs aplicadas:** ADR-0001 (microsserviço auth), ADR-0005 (JWT)

**Princípios SOLID documentados:**
- `auth-service/repositories/userRepository.js` — **SRP**: encapsula todo SQL da tabela `users`; **DIP**: depende de `db.js`, não de `pg` diretamente
- `auth-service/services/authService.js` — **SRP**: regra de negócio de autenticação isolada da camada HTTP
- `auth-service/server.js` — **SRP**: controller apenas orquestra; **DIP**: depende de `authService`

**Desvios ou findings relevantes:** Tipo inválido (`tipo: "empresa"`) retornava HTTP 500 em vez de 400 — corrigido adicionando validação `['advogado','comum'].includes(tipo)` no `authService`. Migration automática ausente — resolvida com `entrypoint.sh`.

---

### Fase 2.2 — REQ03 + REQ04: Login e Logout

**Status:** ✅ Concluída

**Arquivos editados:**
- `auth-service/services/authService.js` — função `login(email, senha)` adicionada: busca usuário, compara hash via `bcrypt`, emite JWT com payload `{ userId, email, tipo }` e `expiresIn: '8h'`
- `auth-service/server.js` — rota `POST /auth/login` delegada para `authService.login()`; retorna `{ token, user }` ou 401
- `frontend/login.html` — `localStorage.setItem('veridit_token', token)` após login; `API_BASE` usando `/api/auth` (preparado para gateway)
- `frontend/creditos.html` — `verificarSessao()` lê `veridit_token`; `logout()` executa `localStorage.removeItem('veridit_token')` e redireciona para `login.html`

**ADRs aplicadas:** ADR-0005 (JWT stateless; logout exclusivamente client-side), ADR-0002 (REST síncrono)

**Princípios SOLID documentados:**
- `auth-service/services/authService.js` — **SRP**: regra de negócio de login isolada da camada HTTP

**Desvios ou findings relevantes:** Bug `bcrypt.compare(email, undefined)` causava HTTP 500; corrigido com guard `if (!email || !senha)` no início de `login()`. Logout sem endpoint de backend confirma aderência à ADR-0005.

---

## Sprint 3 — Domínio de Pagamento (REQ05, REQ06)

> Objetivo: catálogo de pacotes, seleção e checkout real com persistência e circuit breaker.

---

### Fase 3.1 — REQ05: Catálogo de Pacotes e Compra de Créditos

**Status:** ✅ Concluída

**Arquivos criados:**
- `payment-service/migrations/001_create_tables.sql` — tabelas `credit_packages` e `purchases` com seed de 3 pacotes (Básico, Médio, Premium)
- `payment-service/db.js` — pool de conexão PostgreSQL idêntico ao auth-service
- `payment-service/entrypoint.sh` — aguarda banco e executa migration antes de subir
- `payment-service/repositories/packageRepository.js` — `listPackages()` e `findById(id)`
- `payment-service/repositories/purchaseRepository.js` — `createPurchase(data)`
- `payment-service/services/paymentService.js` — `listPackages()` e `initiatePurchase(userId, packageId, billingData)` com `pixCode` simulado

**Arquivos editados:**
- `payment-service/server.js` — `GET /payments/packages` (público) e `POST /payments/checkout` (protegido, com persistência real)
- `payment-service/Dockerfile` — `postgresql-client` adicionado para entrypoint
- `payment-service/package.json` — dependência `pg` adicionada
- `docker-compose.yml` — variáveis de banco para `payment-service`
- `frontend/checkout.html` — `finalizarPedido()` substituída por `fetch` real ao backend com JWT no header; `API_BASE` adicionada
- `docs/ADRs/ADR-0006_*.md` — Desvio 5 (catálogo no payment-service em vez de catalog-service separado) documentado

**ADRs aplicadas:** ADR-0001, ADR-0002, ADR-0006 Desvio 4

**Princípios SOLID documentados:**
- `payment-service/db.js` — **SRP**: gerencia exclusivamente conexão com o banco
- `payment-service/repositories/packageRepository.js` — **SRP**: encapsula todo SQL de `credit_packages`
- `payment-service/repositories/purchaseRepository.js` — **SRP**: encapsula todo SQL de `purchases`
- `payment-service/services/paymentService.js` — **SRP**: regra de negócio isolada da camada HTTP; **DIP**: depende de abstrações; **OCP**: novo provedor substituiria apenas `pixService`

**Desvios ou findings relevantes:** Desvio 4 (checkout.html sem chamada ao backend) corrigido. Desvio 5 (catálogo sem serviço separado) conscientemente aceito e documentado na ADR-0006 dado o escopo acadêmico.

---

### Fase 3.2 — REQ06: Geração de QR Code / PIX

**Status:** ✅ Concluída

**Arquivos criados:**
- `payment-service/services/pixService.js` — `generatePixCode(purchaseId, value)` gera string PIX EMV simulada no formato `PIX<id><valor><timestamp>`
- `payment-service/resilience/circuitBreaker.js` — `createCircuitBreaker(asyncFn)` com `opossum`: `timeout: 3000`, `errorThresholdPercentage: 50`, `resetTimeout: 10000`; loga estados aberto/semi-aberto/fechado

**Arquivos editados:**
- `payment-service/services/paymentService.js` — usa `pixService` e circuit breaker para chamada ao repositório; erro 503 quando circuito aberto
- `payment-service/repositories/purchaseRepository.js` — `findById(id)` adicionado
- `payment-service/server.js` — `GET /payments/purchases/:id` (protegido) com checagem de ownership e tratamento de 503

**ADRs aplicadas:** ADR-0002 (REST síncrono para operações transacionais), ADR-0004 (circuit breaker com opossum)

**Princípios SOLID documentados:**
- `payment-service/services/pixService.js` — **SRP**: gera apenas código PIX; **OCP**: substituível por integração real sem alterar `paymentService`
- `payment-service/resilience/circuitBreaker.js` — **SRP**: encapsula exclusivamente lógica de circuit breaker; **OCP**: aceita qualquer função assíncrona

**Desvios ou findings relevantes:** PIX simulado (sem integração real com banco/provedor) é desvio consciente documentado na ADR-0006 Desvio 5.

---

## Sprint 4 — Infraestrutura e Demonstração (REQ07 + API Gateway + SOLID Docs)

> Objetivo: mensageria assíncrona (REQ07), API Gateway nginx, e documentação final.

---

### Fase 4.1 — REQ07: Confirmação de Pagamento por Email via RabbitMQ

**Status:** ✅ Concluída

**Arquivos criados:**
- `notification-service/package.json` — dependência `amqplib`, node >= 18
- `notification-service/Dockerfile` — node:18-alpine
- `notification-service/index.js` — conecta ao RabbitMQ com retry (10x/5s); declara exchange `payment_events` (direct), queue `payment.confirmed` com DLX/TTL, queue `payment.confirmed.dlq`; consome e loga `[EMAIL] Enviando confirmação para <email> — compra <id>`
- `payment-service/messaging/publisher.js` — `publishPaymentConfirmed(purchaseData)` publica no exchange `payment_events` com routing key `payment.confirmed`

**Arquivos editados:**
- `docker-compose.yml` — `rabbitmq:3-management` (healthcheck) e `notification-service` adicionados; `payment-service` recebe `RABBITMQ_URL`
- `payment-service/package.json` — dependência `amqplib` adicionada
- `payment-service/services/paymentService.js` — `publishPaymentConfirmed` chamada após checkout bem-sucedido em `try/catch` isolado (falha não quebra o checkout)

**ADRs aplicadas:** ADR-0001 (broker assíncrono), ADR-0002 (fila para background), ADR-0003 (RabbitMQ + DLX)

**Princípios SOLID documentados:**
- `notification-service/index.js` — **SRP**: só notifica, não conhece regras de pagamento
- `payment-service/messaging/publisher.js` — **SRP**: responsabilidade única de publicar eventos

**Desvios ou findings relevantes:** DLQ funcional — mensagens que excedem TTL (5s) ou são nack'd vão para `payment.confirmed.dlq`, conforme ADR-0003. Publisher failure não retorna 503 ao cliente — pagamento já estava gravado.

---

### Fase 4.2 — API Gateway (nginx) + Remoção de URLs Hardcoded

**Status:** ✅ Concluída

**Arquivos criados:**
- `gateway/nginx.conf` — proxy: `/api/auth/*` → `auth-service:3001/auth/`, `/api/payments/*` → `payment-service:3002/payments/`, `/` → frontend estático
- `frontend/` (pasta) — todos os HTMLs movidos da raiz para cá

**Arquivos editados:**
- `frontend/login.html` — `AUTH_BASE = '/api/auth'`; fetch atualizado
- `frontend/cadastro.html` — `AUTH_BASE = '/api/auth'`; fetch atualizado
- `frontend/checkout.html` — `PAYMENTS_BASE = '/api/payments'`; fetch atualizado
- `docker-compose.yml` — serviço `gateway` adicionado (porta 80); `ports: 3001:3001` e `3002:3002` removidos dos serviços de backend

**ADRs aplicadas:** ADR-0001 (API Gateway como ponto único de entrada), ADR-0006 Desvio 3 (completo)

**Desvios ou findings relevantes:** Desvio 3 (URLs hardcoded + ausência de gateway) completamente corrigido. nginx.conf exigiu ajuste no `proxy_pass` para rewrite correto do path (`auth-service:3001/auth/` em vez de `auth-service:3001/`).

---

### Fase 4.3 — Documentação SOLID e README Final

**Status:** ✅ Concluída

**Arquivos criados:**
- `docs/SPRINT-RESULT.md` — este arquivo
- `docs/SOLID_AUDIT.md` — auditoria completa dos princípios SOLID aplicados no código
- `docs/REQUIREMENTS_SPRINT1.md` — tabela dos requisitos entregues com status e mecanismo

**Arquivos movidos:**
- `ADRs/ADR-000*.md` → `docs/ADRs/ADR-000*.md` (6 arquivos)
- `ESTADO_ATUAL_TRABALHO3.md` → `docs/ESTADO_ATUAL_TRABALHO3.md`

**Arquivos editados:**
- `docs/ESTADO_ATUAL_TRABALHO3.md` — reescrito refletindo o estado final do projeto
- `PLAN.md` — bloco de conclusão adicionado ao topo
- `README.md` — substituído por instruções completas de execução e estrutura do projeto
- `.gitignore` — entrada `.claude/` adicionada

**ADRs aplicadas:** Todas (documentação transversal)

---

## Resumo da Sprint Final

### Requisitos entregues

| Requisito | Descrição | Status |
|-----------|-----------|--------|
| REQ01 | Cadastrar Usuário (advogado e comum) | ✅ Entregue |
| REQ03 | Logar no Sistema | ✅ Entregue |
| REQ04 | Sair do Sistema | ✅ Entregue |
| REQ05 | Comprar Créditos (selecionar pacote) | ✅ Entregue |
| REQ06 | Efetuar Pagamento (PIX simulado + circuit breaker) | ✅ Entregue |
| REQ07 | Confirmar pagamento por email via RabbitMQ | ✅ Entregue |

**Total: 6 de 15 requisitos = 40% — acima da meta de 30%**

REQ02 (recuperar senha) e REQ08–REQ15 (captura, relatórios, zip) fora do escopo desta sprint, conforme PLAN.md.

---

### Serviços implementados e seus papéis

| Serviço | Papel |
|---------|-------|
| `gateway` (nginx) | API Gateway + servidor de frontend estático; único ponto de entrada na porta 80 |
| `auth-service` | Cadastro (REQ01), login (REQ03) e suporte ao logout client-side (REQ04); emite JWT |
| `payment-service` | Catálogo de pacotes (REQ05), checkout com PIX simulado (REQ06) e circuit breaker |
| `notification-service` | Consome fila `payment.confirmed` e loga confirmação de email (REQ07) |
| `rabbitmq` | Message broker; DLX + DLQ para mensagens com falha |
| `db_auth` | PostgreSQL exclusivo do auth-service |
| `db_payments` | PostgreSQL exclusivo do payment-service |

**Total: 7 containers, 4 serviços de aplicação**

---

### ADRs produzidas

| ADR | Decisão |
|-----|---------|
| ADR-0001 | Estilo arquitetural: microsserviços com broker assíncrono |
| ADR-0002 | Estratégia de comunicação: REST síncrono + fila assíncrona |
| ADR-0003 | Escolha do message broker: RabbitMQ |
| ADR-0004 | Estratégia de resiliência: retry, DLQ e circuit breaker (opossum) |
| ADR-0005 | Estratégia de autenticação: JWT stateless em cada serviço |
| ADR-0006 | Desvios arquiteturais documentados (5 desvios, todos corrigidos ou justificados) |

**Total: 6 ADRs**
