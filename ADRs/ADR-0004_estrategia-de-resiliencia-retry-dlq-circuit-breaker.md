# Resiliência via opossum (Circuit Breaker) + Retry Manual + DLQ no RabbitMQ

## Context and Problem Statement

A ADR 001 do Grupo 2 exige circuit breaker, retries e Dead-Letter Queue para garantir que nenhum documento ou transação seja perdida. O código atual (`payment-service/server.js`, `auth-service/server.js`) não possui nenhum mecanismo de resiliência: falhas em dependências externas (banco, broker) retornam erro imediato sem retry. O escopo acadêmico limita o quanto de infraestrutura de resiliência é viável de implementar e demonstrar.

## Considered Options

* Implementação manual — escrever lógica de retry com backoff e estado de circuit breaker do zero
* Biblioteca `opossum` (Node.js) + DLQ nativa do RabbitMQ — circuit breaker encapsula chamadas externas; mensagens rejeitadas vão para dead-letter exchange
* Somente retry com backoff exponencial + DLQ, sem circuit breaker — simplificação consciente do escopo

## Decision Outcome

Chosen option: "opossum + DLQ nativa do RabbitMQ", because `opossum` é a biblioteca de circuit breaker padrão no ecossistema Node.js/Express, adiciona-se com `npm install opossum` sem infraestrutura extra, e pode ser demonstrada ao professor com estados aberto/fechado visíveis em logs. A DLQ é implementada via Dead-Letter Exchange do RabbitMQ (já escolhido na ADR-0003), sem necessidade de código adicional. Implementação manual seria extensa e propensa a bugs em prazo curto; simplificar para apenas retry eliminaria o circuit breaker que é tática obrigatória listada pelo Grupo 2.

### Consequences

* Good, because opossum encapsula qualquer chamada síncrona (banco de dados, serviço externo) em poucos parâmetros configuráveis, e o circuit breaker impede que falhas em cascata derrubem todo o sistema
* Bad, because o circuit breaker só é relevante quando há dependências externas reais para proteger; no estado atual, onde o payment-service não chama nenhum serviço externo de fato, opossum envolve uma lógica simulada — demonstra o padrão sem provar seu valor real
