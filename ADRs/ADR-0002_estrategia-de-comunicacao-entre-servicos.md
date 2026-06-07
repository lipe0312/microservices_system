# REST Síncrono para Operações Transacionais + Broker Assíncrono para Background

## Context and Problem Statement

O Veridit tem dois perfis de operação radicalmente diferentes: operações transacionais com resposta imediata necessária (login, compra de créditos) e operações de processamento longo em background (envio de e-mail, captura de mídia, geração de relatório). Usar uma única estratégia de comunicação para ambos prejudica performance ou simplicidade. O código atual (`auth-service/server.js`, `payment-service/server.js`) já usa REST HTTP síncrono para os fluxos transacionais.

## Considered Options

* REST puro — todos os fluxos síncronos via HTTP; processamento longo bloqueia o request do usuário
* gRPC — chamadas síncronas binárias de alta performance entre serviços internos
* REST síncrono + fila assíncrona — REST para operações transacionais, broker de mensagens para operações de background

## Decision Outcome

Chosen option: "REST síncrono + fila assíncrona", because o REST já está implementado nos dois serviços existentes e é suficiente para as operações de baixa latência (login em `POST /auth/login`, compra em `POST /payments/checkout`). gRPC adicionaria complexidade de serialização (Protobuf) sem ganho real no escopo acadêmico. O broker cobre o caso de uso assíncrono (notificações por e-mail, processamento de mídia) sem bloquear a resposta HTTP ao usuário, atendendo ao requisito de Performance do Grupo 2.

### Consequences

* Good, because o frontend já consome endpoints REST diretamente e não precisa ser alterado para suportar a comunicação síncrona; a divisão síncrono/assíncrono é explícita e fácil de demonstrar ao professor
* Bad, because dois paradigmas de comunicação (REST e broker) aumentam a superfície de conhecimento necessário e dificultam o rastreamento de fluxos que cruzam a fronteira síncrona/assíncrona
