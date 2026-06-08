# Veridit — Plataforma de Captura de Provas Digitais

Trabalho III — Engenharia de Software I (Prof. Dr. Eduardo Almeida)  
Implementação de 40% dos requisitos com arquitetura de microsserviços.

---

## Como rodar

```bash
docker-compose up --build
```

Aguardar todos os containers subirem. Acessar: http://localhost

---

## Serviços

| Serviço | Função | Porta interna |
|---------|--------|---------------|
| gateway (nginx) | API Gateway + frontend estático | 80 (host) |
| auth-service | Autenticação e cadastro | 3001 (interno) |
| payment-service | Pacotes e checkout | 3002 (interno) |
| notification-service | Confirmação por email (RabbitMQ) | — |
| rabbitmq | Message broker | 15672 (painel, host) |
| db_auth | PostgreSQL do auth | interno |
| db_payments | PostgreSQL do payment | interno |

---

## Painel RabbitMQ

http://localhost:15672 — usuário: `guest` / senha: `guest`

---

## Requisitos implementados (Sprint 1 — 40%)

REQ01, REQ03, REQ04, REQ05, REQ06, REQ07

---

## Documentação

- `docs/ADRs/` — Architecture Decision Records (6 ADRs)
- `docs/SOLID_AUDIT.md` — Auditoria dos princípios SOLID aplicados no código
- `docs/REQUIREMENTS_SPRINT1.md` — Tabela dos requisitos entregues com endpoints
- `docs/SPRINT-RESULT.md` — Resultado detalhado de cada fase do PLAN.md
- `docs/ESTADO_ATUAL_TRABALHO3.md` — Estado final do projeto
