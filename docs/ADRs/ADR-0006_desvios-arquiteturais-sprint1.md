# Desvios Arquiteturais Conscientes da Sprint 1 em Relação à Especificação do Grupo 2

## Context and Problem Statement

A especificação do Grupo 2 define componentes e táticas que não foram integralmente implementados na Sprint 1 do Trabalho III. Quatro desvios concretos foram identificados por auditoria do código atual (evidenciados em `ESTADO_ATUAL_TRABALHO3.md`). Esta ADR documenta cada desvio como decisão consciente, com justificativa e impacto, para proteger o grupo durante a apresentação ao professor.

## Considered Options

* Implementar todos os componentes obrigatórios antes da apresentação — API Gateway, broker, circuit breaker, persistência real
* Implementar o subconjunto mínimo funcional que demonstra o fluxo ponta-a-ponta, documentando os desvios explicitamente
* Manter o estado atual sem documentação — risco máximo na avaliação

## Decision Outcome

Chosen option: "Implementar o subconjunto mínimo funcional, documentando os desvios explicitamente", because o prazo de apresentação (04/06/2026 e 09/06/2026) inviabiliza a implementação completa de todos os componentes sem comprometer a qualidade do que já foi entregue. Os quatro desvios abaixo são dívida técnica classificada e rastreada, não abandono da arquitetura.

### Consequences

* Good, because os desvios documentados demonstram maturidade arquitetural: o grupo conhece o que falta, sabe o custo de cada lacuna e tem um plano de endereçamento — isso é mais valioso academicamente do que código incompleto não documentado
* Bad, because o sistema não cumpre integralmente os requisitos não-funcionais de Confiabilidade e Elasticidade na versão atual; qualquer teste de carga ou falha de rede expõe as lacunas durante a demonstração

---

## Desvio 1 — Fallback Silencioso de Autenticação no Frontend

**Localização:** `login.html` linhas 78–83  
**O que foi implementado:** Se o `auth-service` estiver inacessível, o frontend autentica o usuário com um `mock-token` falso e redireciona normalmente, sem nenhum aviso visual.  
**O que a arquitetura exigia:** Tratamento de erro explícito com mensagem ao usuário; nenhum bypass de autenticação.  
**Justificativa:** Necessidade de validar o fluxo visual durante o desenvolvimento sem Docker ativo.  
**Impacto:** Vulnerabilidade de segurança ativa na demo — qualquer falha de rede autentica o usuário silenciosamente. **Deve ser removido antes da entrega final.**

---

## Desvio 2 — Persistência em Memória no Auth Service

**Localização:** `auth-service/server.js` linha 11 — `const users = [];`  
**O que foi implementado:** Array em memória substitui o PostgreSQL declarado no `docker-compose.yml`.  
**O que a arquitetura exigia:** Serviço stateless com estado de usuários persistido no `db_auth` (PostgreSQL 15).  
**Justificativa:** Redução de complexidade na iteração inicial; o cliente PostgreSQL (`pg`) não foi instalado.  
**Impacto:** Todos os usuários cadastrados são perdidos ao reiniciar o container. A demo exige recadastro a cada `docker-compose down`. Classificado como dívida técnica P1.

---

## Desvio 3 — Ausência de API Gateway

**Localização:** `login.html:64`, `cadastro.html:141` — URLs hardcoded `http://localhost:3001` e `http://localhost:3002`  
**O que foi implementado:** Frontend acessa os serviços diretamente pela porta exposta, sem intermediário.  
**O que a arquitetura exigia:** API Gateway (nginx ou Traefik) como único ponto de entrada externo, ocultando a topologia interna.  
**Justificativa:** Gateway foi adiado para não ser bloqueante ao fluxo funcional da Sprint 1.  
**Impacto:** Qualquer mudança de porta ou host do serviço exige alteração em todos os arquivos HTML; a topologia interna está exposta ao cliente.

---

## Desvio 4 — Fluxo de Pagamento Síncrono sem Message Broker

**Localização:** `checkout.html` linhas 114–118 — `finalizarPedido()` exibe `alert()` sem chamar o backend  
**O que foi implementado:** O fluxo de checkout é uma simulação client-side; o endpoint `POST /payments/checkout` existe no backend mas nunca é invocado pelo frontend.  
**O que a arquitetura exigia:** Checkout via REST síncrono + publicação de evento assíncrono no broker para notificação por e-mail e atualização de saldo.  
**Justificativa:** RabbitMQ não foi integrado na Sprint 1; a conexão do `checkout.html` ao backend foi adiada.  
**Impacto:** Não há processamento real de pagamento nem mecanismo de DLQ para falhas de transação. O fluxo de pagamento é completamente não-funcional no backend.

---

## Desvio 5 — Catálogo de Preços gerenciado pelo payment-service

**O que a arquitetura exigia:** Componente `catalog-service` separado.  
**O que foi implementado:** Tabela `credit_packages` e rotas de catálogo dentro do `payment-service`.  
**Justificativa:** Escopo acadêmico — criar um microsserviço separado para 3 pacotes estáticos não agrega valor demonstrável e aumenta complexidade operacional sem necessidade.  
**Impacto:** Baixo. O catálogo pode ser extraído para serviço próprio sem alterar contratos de API do payment-service.
