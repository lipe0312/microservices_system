# Adoção de Microsserviços Assistido por Broker de Eventos

## Context and Problem Statement

O Veridit precisa isolar operações de alto custo computacional (captura de mídia, geração de relatórios ZIP) das operações leves (login, consulta de saldo) para atender simultaneamente aos atributos de Elasticidade, Confiabilidade e Performance. A solução precisa ser viável de executar localmente com `docker-compose` para apresentação acadêmica, descartando opções que exijam cluster de nuvem ou infraestrutura cara.

## Considered Options

* Monólito Modular — um único processo Node.js com módulos internos separados
* Orientada a Eventos pura — todos os serviços se comunicam exclusivamente via broker, sem chamadas síncronas
* Microsserviços + Broker de Eventos — serviços independentes para cada subdomínio, com REST síncrono para operações transacionais e broker assíncrono para processamento em background

## Decision Outcome

Chosen option: "Microsserviços + Broker de Eventos", because atende ao direcionador eliminatório de Elasticidade (cada serviço pode escalar de forma independente) e Confiabilidade (falha em um serviço não derruba os demais). A separação física entre `auth-service` e `payment-service` já está implementada no repositório com Dockerfiles e bancos de dados individuais. O broker assíncrono viabiliza o processamento de mídia em background sem bloquear o usuário (Performance). Todo o ambiente sobe com `docker-compose up`, sem dependência de Kubernetes ou cloud.

### Consequences

* Good, because cada serviço pode ser desenvolvido, testado e escalado de forma independente, e falhas isoladas não propagam para todo o sistema
* Bad, because aumenta a complexidade operacional: rastreamento distribuído, debugging cross-serviço e consistência eventual exigem disciplina que um monólito não exige
