# RabbitMQ como Message Broker da Plataforma Veridit

## Context and Problem Statement

A ADR-0001 exige um broker de eventos para comunicação assíncrona entre serviços. O Grupo 2 especificou essa necessidade (ADR 005 original) mas não escolheu qual tecnologia usar. O broker precisa suportar Dead-Letter Queue para atender ao requisito de Confiabilidade do Grupo 2, e deve ser inicializável com um único container Docker sem configuração de cluster, dado o contexto de apresentação acadêmica.

## Considered Options

* Kafka — broker de streaming de alta throughput; requer ZooKeeper ou KRaft, complexo de configurar
* Redis Streams — append-only log no Redis; não possui DLQ nativa, suporte a reentrega é limitado
* RabbitMQ — broker de mensagens AMQP com suporte nativo a exchanges, queues e dead-letter exchanges (DLX)

## Decision Outcome

Chosen option: "RabbitMQ", because é o único entre as três opções que sobe como container Docker único sem dependências externas (`image: rabbitmq:3-management`) e possui Dead-Letter Exchange (DLX) nativo, atendendo ao requisito de DLQ da ADR 001 do Grupo 2. Kafka exigiria ZooKeeper/KRaft e configuração de partições — inviável para `docker-compose` acadêmico sem overhead operacional. Redis Streams não possui semântica de DLQ suficiente para garantir reprocessamento de pagamentos falhos.

### Consequences

* Good, because o painel de gerenciamento (`rabbitmq:3-management`, porta 15672) é visualmente demonstrável ao professor e torna o fluxo de mensagens observável em tempo real durante a apresentação
* Bad, because RabbitMQ usa modelo de push (consumers confirmam acks) que é mais complexo de implementar corretamente do que polling simples; mensagens não confirmadas ficam retidas e podem causar memory pressure se o consumer travar
