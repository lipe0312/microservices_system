# JWT Stateless Validado Localmente em Cada Serviço

## Context and Problem Statement

O `auth-service` emite tokens JWT após login (`auth-service/server.js:36`), mas o `payment-service` não valida nenhum `Authorization` header (`payment-service/server.js:14-31`) — qualquer cliente não autenticado pode chamar `POST /payments/checkout` diretamente. Com a exigência de serviços stateless (ADR 002 do Grupo 2) e a ausência de API Gateway na Sprint 1 (documentada na ADR-0006), é necessário decidir onde e como a validação de token ocorre.

## Considered Options

* JWT validado somente no API Gateway — um único ponto de verificação antes de rotear para serviços internos; os serviços internos confiam em qualquer request que chegue pelo gateway
* Sessão centralizada — serviço de sessão compartilhada (Redis/banco); todos os serviços consultam esse serviço para verificar autenticidade
* JWT stateless validado em cada serviço — cada serviço verifica a assinatura do token usando o `JWT_SECRET` compartilhado via variável de ambiente, sem chamada de rede

## Decision Outcome

Chosen option: "JWT stateless validado em cada serviço", because é a única opção compatível com serviços stateless (sem estado de sessão no servidor) conforme exigido pela ADR 002 do Grupo 2. Sem API Gateway implementado, a validação no gateway é inviável neste momento. A sessão centralizada introduziria um ponto único de falha e exigiria uma dependência de rede em toda requisição autenticada — contrário ao requisito de Confiabilidade. Com `JWT_SECRET` injetado via `process.env.JWT_SECRET` no `docker-compose.yml`, cada serviço valida o token autonomamente sem coordenação.

### Consequences

* Good, because a validação é local e sem latência de rede; um serviço pode autenticar requests mesmo que o `auth-service` esteja temporariamente indisponível, aumentando a resiliência do sistema
* Bad, because o segredo `JWT_SECRET` precisa ser compartilhado entre todos os serviços via variável de ambiente — qualquer rotação do segredo exige restart simultâneo de todos os containers; tokens emitidos antes da rotação se tornam inválidos imediatamente
