# PLAN.md — Veridit | Plano de Implementação

---

> **Status: ✅ Concluído**  
> Sprint encerrada em: 2026-06-07  
> Requisitos entregues: REQ01, REQ03, REQ04, REQ05, REQ06, REQ07 (40% — acima da meta de 30%)  
> Resultado: Ver `docs/SPRINT-RESULT.md`

---

> Disciplina: Engenharia de Software I — Prof. Dr. Eduardo Almeida  
> Trabalho III | Meta: 30% dos requisitos funcionando + arquitetura de microsserviços aderente às ADRs  
> Stack confirmada: Node.js + Express | PostgreSQL | RabbitMQ | Docker Compose  
> Repositório: estrutura de pastas por serviço (`auth-service/`, `payment-service/`, `frontend/`)

---

## Mapa de Requisitos-Alvo (30% = 5 de 15)

| Req | Descrição | Serviço Responsável | Sprint |
|-----|-----------|---------------------|--------|
| REQ01 | Cadastrar Usuário (advogado e comum) | `auth-service` | 2 |
| REQ03 | Logar no Sistema | `auth-service` | 2 |
| REQ04 | Sair do Sistema | `auth-service` + frontend | 2 |
| REQ05 | Comprar Créditos (selecionar pacote) | `payment-service` + `catalog-service` | 3 |
| REQ06 | Efetuar Pagamento (PIX/QR Code) | `payment-service` | 3 |
| REQ07 | Confirmar pagamento por email *(bônus — demonstra broker)* | `notification-service` via RabbitMQ | 4 |

> REQ02 (recuperar senha), REQ08–REQ15 (captura, relatórios, zip) ficam fora desta sprint. Não implementar.

---

## ADRs que governam este plano

| ADR | Decisão | Impacto direto no código |
|-----|---------|--------------------------|
| ADR-0001 | Microsserviços + Broker | Cada serviço = processo separado, Dockerfile próprio, porta própria |
| ADR-0002 | REST síncrono + fila assíncrona | Login/cadastro/pagamento = REST. Email de confirmação = fila |
| ADR-0003 | RabbitMQ como broker | `rabbitmq:3-management` no docker-compose. DLX configurado |
| ADR-0004 | `opossum` + DLQ | Circuit breaker no `payment-service` para chamada ao banco |
| ADR-0005 | JWT stateless em cada serviço | `JWT_SECRET` via env. Middleware de validação em cada serviço |
| ADR-0006 | 4 desvios documentados | Sprint 1 existe exclusivamente para corrigir esses desvios |

---

## REGRAS GLOBAIS PARA A IA (ler antes de cada fase)

```
1. Leia TODOS os arquivos do repositório antes de escrever qualquer código.
2. Nunca reescreva um arquivo que já existe e está correto — use str_replace ou edição cirúrgica.
3. Nunca instale biblioteca não listada neste plano sem justificar com uma ADR.
4. Nunca crie um novo serviço que não esteja listado neste plano.
5. SOLID deve ser aplicado e comentado inline com: // [SOLID: SRP] motivo
6. Todo endpoint novo deve ter tratamento de erro explícito (try/catch + status HTTP correto).
7. Nenhum segredo (senhas, JWT_SECRET) deve ser hardcoded — sempre via process.env.
8. Após cada fase, o docker-compose up deve subir sem erros.
```

---

## Sprint 1 — Quitação da Dívida Técnica (ADR-0006)

> **Objetivo:** Corrigir os 4 desvios documentados na ADR-0006 antes de construir qualquer feature nova.  
> Nenhum requisito novo é entregue nesta sprint. O resultado é um repositório sem armadilhas.

---

### Fase 1.1 — Remover mock-token e conectar auth-service ao PostgreSQL

**ADRs:** ADR-0005 (JWT stateless), ADR-0006 Desvio 1 e Desvio 2

**Contexto para a IA:**
```
Leia: frontend/login.html, auth-service/server.js, docker-compose.yml
Problema 1 (Desvio 1): login.html possui um bloco catch que autentica o usuário 
com um mock-token se o auth-service estiver inacessível. Isso é uma vulnerabilidade 
de segurança ativa. Deve ser removido completamente.
Problema 2 (Desvio 2): auth-service/server.js usa `const users = []` em memória. 
O docker-compose.yml já declara um container PostgreSQL (db_auth). 
O banco existe mas não está sendo usado.
```

**O que fazer:**
1. Em `frontend/login.html`: remover o bloco `catch` que seta `mock-token`. Substituir por exibição de mensagem de erro clara ao usuário. Nada mais.
2. Em `auth-service/`:
   - Instalar `pg` (`npm install pg`)
   - Criar `auth-service/db.js` — módulo único de conexão com o PostgreSQL via `process.env.DB_*`. **[SOLID: SRP]** — responsabilidade de conexão isolada.
   - Criar `auth-service/migrations/001_create_users.sql` — tabela `users` com campos do Apêndice A (nome, email, senha_hash, cpf, tipo, oab_numero nullable).
   - Substituir o array `users` em `server.js` por queries ao banco. Usar `bcrypt` para hash de senha (`npm install bcrypt`).
3. Em `docker-compose.yml`: garantir que `auth-service` tem `depends_on: db_auth` e as variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` injetadas.

**Não fazer:** Não criar ORM (Sequelize, Prisma). SQL puro com `pg` é suficiente e evita over-engineering.

**SOLID aplicado:**
- `db.js` = **SRP** (só gerencia conexão)
- `server.js` chama `db.js` via import = **DIP** (depende de abstração, não de implementação direta)

**Verificação:** `docker-compose up` → `POST /auth/register` cadastra usuário → usuário persiste após `docker-compose restart auth-service`.

---

### Fase 1.2 — Adicionar validação JWT no payment-service

**ADRs:** ADR-0005 (JWT stateless), ADR-0006 Desvio 3 parcial

**Contexto para a IA:**
```
Leia: payment-service/server.js, auth-service/server.js (para entender o formato do JWT emitido)
Problema: payment-service não valida nenhum Authorization header.
Qualquer cliente não autenticado pode chamar POST /payments/checkout.
O auth-service já emite JWT com JWT_SECRET via process.env.JWT_SECRET.
```

**O que fazer:**
1. Criar `payment-service/middlewares/auth.js` — middleware Express que lê `Authorization: Bearer <token>`, verifica com `jsonwebtoken` usando `process.env.JWT_SECRET`, e rejeita com 401 se inválido. **[SOLID: SRP]** — middleware só valida token, não sabe nada de pagamento.
2. Em `payment-service/server.js`: aplicar o middleware em todas as rotas protegidas com `router.use(authMiddleware)`.
3. Em `docker-compose.yml`: garantir que `payment-service` recebe a mesma `JWT_SECRET` do `auth-service` via variável de ambiente.

**Não fazer:** Não criar um serviço de validação centralizado. Não chamar o auth-service por HTTP para validar — isso viola a ADR-0005.

**SOLID aplicado:**
- Middleware isolado = **SRP**
- `payment-service/server.js` recebe middleware via parâmetro = **OCP** (aberto para extensão de middlewares, fechado para modificação do core)

**Verificação:** `POST /payments/checkout` sem token → 401. Com token válido → fluxo normal.

---

## Sprint 2 — Domínio de Autenticação (REQ01, REQ03, REQ04)

> **Objetivo:** Entregar os 3 primeiros requisitos funcionando de ponta a ponta: cadastro, login e logout.  
> O resultado desta sprint é um fluxo de autenticação completo e demonstrável ao vivo.

---

### Fase 2.1 — REQ01: Cadastro de Usuário

**ADRs:** ADR-0001 (microsserviço auth), ADR-0005 (JWT)

**Contexto para a IA:**
```
Leia: auth-service/server.js, auth-service/db.js (criado na Fase 1.1), 
frontend/cadastro.html, docker-compose.yml
Estado atual: após a Sprint 1, o auth-service já tem conexão com PostgreSQL e 
tabela users. Verifique o que já existe antes de criar qualquer rota.
Requisito: REQ01 — campos do Apêndice A.
Advogado: nome_completo, email, senha, cpf, numero_oab.
Usuário comum: nome_completo, email, senha, cpf.
Decisão D1: na v1, apenas advogados e usuários comuns são cadastrados.
```

**O que fazer:**
1. Em `auth-service/`:
   - Criar `auth-service/repositories/userRepository.js` — funções `createUser(data)` e `findByEmail(email)`. Encapsula todo SQL. **[SOLID: SRP + DIP]**
   - Criar `auth-service/services/authService.js` — função `register(userData)`: valida campos obrigatórios por tipo de usuário, chama `userRepository.createUser`, retorna resultado. **[SOLID: SRP]** — regra de negócio isolada da camada HTTP.
   - Em `server.js`: rota `POST /auth/register` chama `authService.register`. Trata erros (email duplicado = 409, campos faltando = 400). **[SOLID: SRP]** — controller só orquestra.
2. Em `frontend/cadastro.html`: remover qualquer URL hardcoded `localhost:300X`. Usar uma constante `const API_BASE = window.ENV_API_BASE || 'http://localhost:3001'` no topo do script. *(O API Gateway virá na Sprint 4 — por ora, a constante facilita a troca.)*

**Não fazer:** Não criar validação com Joi/Yup. Validação manual é suficiente para o escopo.

**Verificação:** `POST /auth/register` com body de advogado → 201. Com body incompleto → 400. Email duplicado → 409.

---

### Fase 2.2 — REQ03 + REQ04: Login e Logout

**ADRs:** ADR-0005 (JWT stateless), ADR-0002 (REST síncrono)

**Contexto para a IA:**
```
Leia: auth-service/server.js, auth-service/services/authService.js (criado na Fase 2.1),
frontend/login.html
Estado atual: rota de login pode já existir parcialmente. Verifique antes de reescrever.
O JWT deve conter: { userId, email, tipo } no payload.
Logout é client-side: remover token do localStorage e redirecionar.
```

**O que fazer:**
1. Em `auth-service/services/authService.js`: adicionar função `login(email, senha)` — busca usuário, compara hash com `bcrypt.compare`, emite JWT com `expiresIn: '8h'`. **[SOLID: SRP]**
2. Em `auth-service/server.js`: rota `POST /auth/login` chama `authService.login`. Retorna `{ token, user: { nome, email, tipo } }`. Erros: credenciais inválidas = 401.
3. Em `frontend/login.html`: após login bem-sucedido, salvar token em `localStorage.setItem('veridit_token', token)`. Redirecionar para dashboard.
4. Em `frontend/`: criar botão/função de logout que executa `localStorage.removeItem('veridit_token')` e redireciona para login. **Não há endpoint de logout no backend** — JWT é stateless por decisão da ADR-0005.

**Não fazer:** Não criar endpoint `POST /auth/logout` no backend — isso violaria a ADR-0005 (stateless). O logout é exclusivamente client-side nesta arquitetura.

**Verificação:** Login com credenciais corretas → token no localStorage. Logout → token removido, redirecionado para login. Token expirado → chamada ao payment-service retorna 401.

---

## Sprint 3 — Domínio de Pagamento (REQ05, REQ06)

> **Objetivo:** Entregar o fluxo de compra de créditos funcionando de ponta a ponta: catálogo de pacotes, seleção e checkout real chamando o backend.  
> O resultado é o payment-service processando transações reais com banco de dados.

---

### Fase 3.1 — REQ05: Catálogo de Pacotes e Compra de Créditos

**ADRs:** ADR-0001 (microsserviço separado), ADR-0002 (REST síncrono)

**Contexto para a IA:**
```
Leia: TODOS os arquivos de payment-service/, frontend/checkout.html, docker-compose.yml
Decisão D2 (documento de requisitos): pacotes básico, médio e premium na v1.
Campos do pacote (Apêndice A): nome, quantidade_creditos, valor_por_credito, descricao_beneficios.
Estado atual (ADR-0006 Desvio 4): checkout.html exibe alert() sem chamar backend.
Isso deve ser corrigido nesta fase.
NÃO criar um catalog-service separado — o catálogo de pacotes é gerenciado 
pelo payment-service nesta sprint (simplificação justificada pelo escopo acadêmico).
Se necessário, documentar essa decisão como adendo à ADR-0006.
```

**O que fazer:**
1. Em `payment-service/`:
   - Criar tabela `credit_packages` e `purchases` via `payment-service/migrations/001_create_tables.sql`.
   - Criar `payment-service/repositories/packageRepository.js` — `listPackages()` e `findById(id)`. **[SOLID: SRP]**
   - Criar `payment-service/repositories/purchaseRepository.js` — `createPurchase(data)`. **[SOLID: SRP]**
   - Criar `payment-service/services/paymentService.js` — `listPackages()` e `initiatePurchase(userId, packageId, billingData)`. **[SOLID: SRP]** Regra de negócio isolada.
   - Seed inicial: inserir os 3 pacotes (básico, médio, premium) na migration ou em um arquivo `seed.sql`.
   - Rota `GET /payments/packages` — pública (sem JWT). Retorna lista de pacotes.
   - Rota `POST /payments/checkout` — protegida (middleware JWT da Fase 1.2). Recebe `{ packageId, billingData }`. Chama `paymentService.initiatePurchase`. Retorna `{ purchaseId, status: 'pending', pixCode: '<simulado>' }`.
2. Em `frontend/checkout.html`: substituir o `alert()` por chamada real `fetch('http://localhost:3002/payments/checkout', ...)` com o token do localStorage no header `Authorization`. Exibir o `pixCode` retornado.

**Não fazer:** Não integrar Mercado Pago real. O PIX é simulado (string gerada no backend). Isso é desvio consciente — documentar no adendo da ADR-0006 se não estiver lá.

**SOLID aplicado:**
- `packageRepository` e `purchaseRepository` separados = **SRP**
- `paymentService` depende dos repositories via import, não de `pg` diretamente = **DIP**
- Adicionar pacote de pagamento futuro (ex: Mercado Pago) não modifica `paymentService`, só adiciona implementação = **OCP**

**Verificação:** `GET /payments/packages` → lista 3 pacotes. `POST /payments/checkout` sem token → 401. Com token → `{ purchaseId, pixCode }` gravado no banco.

---

### Fase 3.2 — REQ06: Geração de QR Code / PIX

**ADRs:** ADR-0002 (REST síncrono para operações transacionais), ADR-0004 (circuit breaker com opossum)

**Contexto para a IA:**
```
Leia: payment-service/services/paymentService.js, payment-service/server.js
Estado atual após Fase 3.1: checkout retorna pixCode como string simulada.
Esta fase formaliza o gerador de PIX e adiciona o circuit breaker (ADR-0004).
```

**O que fazer:**
1. Em `payment-service/`:
   - Criar `payment-service/services/pixService.js` — função `generatePixCode(purchaseId, value)`: gera string de PIX EMV simulada (formato real mas sem integração de banco). **[SOLID: SRP]** — isolado, substituível por integração real no futuro.
   - Instalar `opossum` (`npm install opossum`).
   - Criar `payment-service/resilience/circuitBreaker.js` — encapsula a chamada ao banco de dados (`purchaseRepository.createPurchase`) com circuit breaker. Configurar: `timeout: 3000`, `errorThresholdPercentage: 50`, `resetTimeout: 10000`. **[SOLID: SRP + OCP]**
   - Em `paymentService.js`: usar o circuit breaker ao chamar o repositório. Logar estado aberto/fechado com `console.warn`.
2. Em `payment-service/server.js`: rota `GET /payments/purchases/:id` (protegida) retorna detalhes da compra incluindo `pixCode`.

**Não fazer:** Não criar dashboard de circuit breaker. Os logs no console são suficientes para demonstrar o padrão ao professor.

**Verificação:** `POST /payments/checkout` → `pixCode` gerado e salvo. Derrubar o banco → circuit breaker abre → resposta 503 em vez de timeout infinito.

---

## Sprint 4 — Infraestrutura e Demonstração (REQ07 + API Gateway + SOLID Docs)

> **Objetivo:** Adicionar o broker para demonstrar mensageria assíncrona (REQ07), subir o API Gateway eliminando URLs hardcoded, e finalizar a documentação SOLID.  
> Esta sprint transforma o sistema de "funcional" para "arquiteturalmente correto e demonstrável".

---

### Fase 4.1 — REQ07: Confirmação de Pagamento por Email via RabbitMQ

**ADRs:** ADR-0001 (broker assíncrono), ADR-0002 (fila para background), ADR-0003 (RabbitMQ + DLX)

**Contexto para a IA:**
```
Leia: TODOS os arquivos do repositório. Especialmente payment-service/services/paymentService.js
e docker-compose.yml.
Objetivo: após POST /payments/checkout bem-sucedido, publicar mensagem na fila 
'payment.confirmed'. Um notification-service consome essa fila e loga o envio 
do email (sem SMTP real — log é suficiente para demonstração).
DLX: mensagens que falharem 3x vão para a fila 'payment.confirmed.dlq'.
```

**O que fazer:**
1. Em `docker-compose.yml`: adicionar serviço `rabbitmq:3-management` (porta 5672 + 15672). Adicionar `notification-service` como novo container.
2. Criar `notification-service/` (serviço novo e simples):
   - `notification-service/package.json` com dependência `amqplib`.
   - `notification-service/index.js` — conecta ao RabbitMQ, declara exchange `payment_events` (type: direct), queue `payment.confirmed` com dead-letter-exchange `payment.dlx`, queue `payment.confirmed.dlq`. Consome mensagens e loga: `[EMAIL] Enviando confirmação para <email> — compra <purchaseId>`. **[SOLID: SRP]** — só notifica, não sabe de pagamento.
   - `notification-service/Dockerfile`.
3. Em `payment-service/`:
   - Criar `payment-service/messaging/publisher.js` — função `publishPaymentConfirmed(purchaseData)`: publica no exchange `payment_events` com routing key `payment.confirmed`. **[SOLID: SRP]**
   - Em `paymentService.js`: após `createPurchase` bem-sucedido, chamar `publisher.publishPaymentConfirmed`. Falha na publicação não deve falhar o checkout (try/catch isolado — o pagamento já foi gravado).

**Não fazer:** Não integrar SMTP real (Nodemailer, SendGrid). O log no console do notification-service demonstra o padrão ao professor de forma clara e sem dependência externa.

**Verificação:** `POST /payments/checkout` → mensagem aparece no painel RabbitMQ (localhost:15672) → log do notification-service exibe o email. Derrubar notification-service → mensagem vai para DLQ após 3 tentativas.

---

### Fase 4.2 — API Gateway (nginx) + Remoção de URLs Hardcoded

**ADRs:** ADR-0001 (modularidade, API Gateway), ADR-0006 Desvio 3

**Contexto para a IA:**
```
Leia: docker-compose.yml, frontend/login.html, frontend/cadastro.html, 
frontend/checkout.html e qualquer outro arquivo HTML/JS que contenha localhost:300X.
Objetivo: subir nginx como API Gateway. Todo acesso do frontend passa por 
http://localhost:80. Internamente, nginx roteia para os serviços.
```

**O que fazer:**
1. Criar `gateway/nginx.conf`:
   ```
   /api/auth/*  → http://auth-service:3001
   /api/payments/* → http://payment-service:3002
   /              → servir frontend estático
   ```
2. Em `docker-compose.yml`: adicionar serviço `nginx` com volume para `gateway/nginx.conf` e `frontend/`. Remover exposição de portas 3001 e 3002 ao host (deixar apenas na rede interna Docker). Manter porta 80 exposta.
3. Em todos os arquivos frontend: substituir `http://localhost:3001` por `/api/auth` e `http://localhost:3002` por `/api/payments`. A constante `API_BASE` criada na Fase 2.1 facilita essa troca — alterar só a constante.

**Não fazer:** Não configurar SSL, rate limiting ou autenticação no gateway. nginx como proxy reverso simples é suficiente.

**Verificação:** `docker-compose up` → tudo acessível em `http://localhost`. Nenhuma porta `300X` acessível diretamente do browser.

---

### Fase 4.3 — Documentação SOLID e README Final

**ADRs:** Todas (documentação transversal)

**Contexto para a IA:**
```
Leia: TODOS os arquivos do repositório no estado final.
Objetivo: gerar dois documentos e atualizar o README.
```

**O que fazer:**
1. Criar `docs/SOLID_AUDIT.md` — para cada princípio SOLID, listar:
   - Onde foi aplicado (arquivo + função)
   - Por que aquela decisão aplica o princípio
   - Exemplo: "SRP — `auth-service/repositories/userRepository.js` — só gerencia persistência de usuários, sem lógica de negócio"
   Usar os comentários `// [SOLID: SRP]` espalhados no código como fonte.

2. Criar `docs/REQUIREMENTS_SPRINT1.md` — tabela com REQ01, REQ03, REQ04, REQ05, REQ06, REQ07: descrição, status (✅ implementado), serviço responsável, endpoint ou mecanismo que o atende.

3. Atualizar `README.md` com:
   ```
   ## Como rodar
   docker-compose up --build
   
   ## Serviços disponíveis
   - Frontend + Gateway: http://localhost
   - RabbitMQ Management: http://localhost:15672 (guest/guest)
   
   ## Requisitos implementados (Sprint 1 — 30%)
   REQ01, REQ03, REQ04, REQ05, REQ06, REQ07
   
   ## ADRs
   Ver pasta ADRs/
   
   ## Princípios SOLID
   Ver docs/SOLID_AUDIT.md
   ```

**Verificação:** `docker-compose up --build` a partir de um clone limpo do repositório sobe todos os serviços sem erro. Fluxo completo: cadastro → login → selecionar pacote → checkout → mensagem no RabbitMQ → log de email.

---

## Checklist Final de Apresentação

```
[ ] docker-compose up --build sobe sem erro em máquina limpa
[ ] REQ01: POST /api/auth/register com campos de advogado e usuário comum → 201
[ ] REQ03: POST /api/auth/login com credenciais corretas → JWT retornado
[ ] REQ04: Logout remove token do localStorage, redireciona para login
[ ] REQ05: GET /api/payments/packages → 3 pacotes listados
[ ] REQ06: POST /api/payments/checkout com JWT → pixCode retornado e salvo no banco
[ ] REQ07: Mensagem visível no painel RabbitMQ (localhost:15672) após checkout
[ ] Circuit breaker: derrubar db_payments → payment-service retorna 503 (não trava)
[ ] JWT: chamar /api/payments/checkout sem token → 401
[ ] API Gateway: nenhum serviço acessível diretamente por porta (só via localhost:80)
[ ] ADRs/: 6 arquivos presentes
[ ] docs/SOLID_AUDIT.md: presente com exemplos reais do código
[ ] docs/REQUIREMENTS_SPRINT1.md: tabela com os 6 requisitos e status
[ ] README.md: instruções de execução claras e completas
```

---

## Resumo de Serviços e Portas (docker-compose)

| Serviço | Porta interna | Porta host | Banco próprio |
|---------|--------------|------------|---------------|
| `nginx` (gateway) | 80 | **80** | — |
| `auth-service` | 3001 | ~~exposta~~ | `db_auth` (PostgreSQL) |
| `payment-service` | 3002 | ~~exposta~~ | `db_payments` (PostgreSQL) |
| `notification-service` | — | — | — |
| `rabbitmq` | 5672 / 15672 | **15672** | — |
| `db_auth` | 5432 | — | — |
| `db_payments` | 5433 | — | — |

---

## Ordem de Execução Recomendada

```
Sprint 1 → Fase 1.1 → Fase 1.2
Sprint 2 → Fase 2.1 → Fase 2.2
Sprint 3 → Fase 3.1 → Fase 3.2
Sprint 4 → Fase 4.1 → Fase 4.2 → Fase 4.3
```

> Cada fase é independente e pode ser passada para a IA com um contexto limpo.  
> Sempre instrua a IA: **"Leia todos os arquivos do repositório antes de escrever qualquer código."**
