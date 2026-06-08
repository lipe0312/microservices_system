# REQUIREMENTS_SPRINT1.md — Requisitos Entregues na Sprint 1

> Projeto: Veridit — Plataforma de Captura de Provas Digitais  
> Disciplina: Engenharia de Software I — Prof. Dr. Eduardo Almeida  
> Meta: 30% dos requisitos funcionando com arquitetura de microsserviços aderente às ADRs  
> Resultado: **40%** (6 de 15 requisitos entregues)

---

## Tabela de Requisitos Implementados

| Requisito | Descrição | Serviço Responsável | Endpoint / Mecanismo | Status |
|-----------|-----------|---------------------|----------------------|--------|
| REQ01 | Cadastrar Usuário (advogado e comum) | `auth-service` | `POST /api/auth/register` | ✅ Implementado |
| REQ03 | Logar no Sistema | `auth-service` | `POST /api/auth/login` → JWT retornado | ✅ Implementado |
| REQ04 | Sair do Sistema | Frontend (`creditos.html`) | `localStorage.removeItem('veridit_token')` + redirect (ADR-0005: logout client-side) | ✅ Implementado |
| REQ05 | Comprar Créditos — selecionar pacote | `payment-service` | `GET /api/payments/packages` (catálogo público) + `POST /api/payments/checkout` (JWT obrigatório) | ✅ Implementado |
| REQ06 | Efetuar Pagamento — PIX/QR Code | `payment-service` | `POST /api/payments/checkout` → `pixCode` gerado via `pixService`; circuit breaker via `opossum` | ✅ Implementado |
| REQ07 | Confirmar pagamento por email | `notification-service` via RabbitMQ | Checkout publica em `payment_events`; `notification-service` consome `payment.confirmed` e loga confirmação | ✅ Implementado |

---

## Requisitos Fora do Escopo desta Sprint

| Requisito | Motivo da Exclusão |
|-----------|--------------------|
| REQ02 | Recuperar senha — não priorizado; sem impacto na demonstração do fluxo principal |
| REQ08–REQ15 | Captura de mídia, processamento, relatórios, ZIP — fora do escopo acadêmico desta entrega |

---

## Detalhamento dos Endpoints

### REQ01 — Cadastro de Usuário

```
POST /api/auth/register

Body (usuário comum):
{
  "nome_completo": "Ana Silva",
  "email": "ana@test.com",
  "senha": "123456",
  "cpf": "12345678900",
  "tipo": "comum"
}

Body (advogado):
{
  "nome_completo": "Carlos OAB",
  "email": "carlos@oab.com",
  "senha": "senha123",
  "cpf": "98765432100",
  "tipo": "advogado",
  "oab_numero": "123456/BA"
}

Respostas:
  201 — cadastro realizado com sucesso
  400 — campos obrigatórios ausentes ou tipo inválido
  409 — email já cadastrado
```

### REQ03 — Login

```
POST /api/auth/login

Body:
{ "email": "ana@test.com", "senha": "123456" }

Resposta 200:
{ "token": "<JWT>", "user": { "nome_completo": "...", "email": "...", "tipo": "..." } }

Resposta 401:
{ "error": "Credenciais inválidas." }
```

### REQ04 — Logout

```
Client-side (ADR-0005 — JWT stateless, sem endpoint de backend):
localStorage.removeItem('veridit_token')
window.location.href = 'login.html'
```

### REQ05 — Catálogo de Pacotes

```
GET /api/payments/packages

Resposta 200 (sem autenticação):
[
  { "id": 1, "nome": "Básico", "quantidade_creditos": 10, "valor_por_credito": "5.00", ... },
  { "id": 2, "nome": "Médio",  "quantidade_creditos": 25, "valor_por_credito": "4.50", ... },
  { "id": 3, "nome": "Premium","quantidade_creditos": 50, "valor_por_credito": "4.00", ... }
]
```

### REQ06 — Checkout com PIX

```
POST /api/payments/checkout
Authorization: Bearer <JWT>

Body:
{ "packageId": 1, "billingData": { "nome": "Ana Silva", "cpf": "12345678900", "email": "ana@test.com" } }

Resposta 201:
{ "purchaseId": 1, "status": "pending", "pixCode": "PIX000001500002026..." }

Resposta 401: token ausente ou inválido
Resposta 503: banco de dados indisponível (circuit breaker aberto)
```

### REQ07 — Confirmação por Email (RabbitMQ)

```
Fluxo assíncrono:
1. payment-service publica em exchange 'payment_events' (direct)
   routing key: 'payment.confirmed'
   payload: { purchaseId, email, packageId }

2. notification-service consome fila 'payment.confirmed'
   Log: [EMAIL] Enviando confirmação para <email> — compra <purchaseId>

3. DLQ: mensagens que excedem TTL (5s) ou são nack'd vão para 'payment.confirmed.dlq'
```
