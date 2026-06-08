# SOLID_AUDIT.md — Auditoria dos Princípios SOLID

> Projeto: Veridit — Plataforma de Captura de Provas Digitais  
> Disciplina: Engenharia de Software I — Prof. Dr. Eduardo Almeida  
> Fonte: comentários `// [SOLID: ...]` presentes no código-fonte do repositório  
> Gerado em: 2026-06-07

---

## S — Single Responsibility Principle (SRP)

> Um módulo deve ter uma única razão para mudar.

| Arquivo | Função / Módulo | Aplicação do SRP |
|---------|-----------------|-----------------|
| `auth-service/db.js` | módulo inteiro | Gerencia exclusivamente a conexão com o banco de dados (Pool do `pg`). Não contém lógica de negócio nem roteamento. |
| `auth-service/repositories/userRepository.js` | `createUser()`, `findByEmail()` | Encapsula todo SQL da tabela `users`. Não conhece bcrypt, JWT nem Express — só fala com o banco. |
| `auth-service/services/authService.js` | `register()` | Regra de negócio de cadastro isolada da camada HTTP. Não sabe de Express, não escreve resposta HTTP. |
| `auth-service/services/authService.js` | `login()` | Regra de negócio de login isolada da camada HTTP. Valida credenciais, compara hash, emite JWT — sem conhecer Request/Response. |
| `auth-service/server.js` | `POST /auth/register` | Controller apenas orquestra: recebe `req.body`, chama `authService.register()`, mapeia erro → status HTTP. Sem lógica de negócio. |
| `auth-service/server.js` | `POST /auth/login` | Controller apenas orquestra: recebe credenciais, chama `authService.login()`, retorna resultado. |
| `payment-service/db.js` | módulo inteiro | Gerencia exclusivamente a conexão PostgreSQL do payment-service. Idêntico em responsabilidade ao auth-service/db.js. |
| `payment-service/middlewares/auth.js` | `authMiddleware()` | Responsabilidade única: validar token JWT no header `Authorization`. Não conhece regras de pagamento nem roteamento. |
| `payment-service/repositories/packageRepository.js` | `listPackages()`, `findById()` | Encapsula todo SQL da tabela `credit_packages`. Não conhece lógica de checkout. |
| `payment-service/repositories/purchaseRepository.js` | `createPurchase()`, `findById()` | Encapsula todo SQL da tabela `purchases`. Não conhece PIX, circuit breaker nem RabbitMQ. |
| `payment-service/services/paymentService.js` | `listPackages()`, `initiatePurchase()` | Regra de negócio de pagamento isolada da camada HTTP. Orquestra repositórios, pixService e publisher. |
| `payment-service/services/pixService.js` | `generatePixCode()` | Responsabilidade única: gerar código PIX simulado no formato EMV. Não conhece banco de dados nem HTTP. |
| `payment-service/resilience/circuitBreaker.js` | `createCircuitBreaker()` | Encapsula exclusivamente a configuração e os eventos do circuit breaker (opossum). |
| `payment-service/messaging/publisher.js` | `publishPaymentConfirmed()` | Responsabilidade única: publicar eventos de pagamento no RabbitMQ. Não conhece lógica de checkout. |
| `notification-service/index.js` | módulo inteiro | Responsabilidade única: consumir eventos da fila `payment.confirmed` e notificar (log de email). Não conhece regras de pagamento nem banco de dados. |

---

## O — Open/Closed Principle (OCP)

> Um módulo deve estar aberto para extensão e fechado para modificação.

| Arquivo | Aplicação do OCP |
|---------|-----------------|
| `payment-service/server.js` | Proteção JWT adicionada via `authMiddleware` sem modificar a lógica das rotas existentes. Novas rotas podem receber ou não o middleware sem alterar o core do servidor. |
| `payment-service/services/paymentService.js` | Para integrar um provedor de pagamento real (Mercado Pago, Stripe), basta substituir `pixService` por outra implementação. `paymentService` permanece inalterado — depende da interface `generatePixCode(id, value)`, não da implementação. |
| `payment-service/services/pixService.js` | Substituível por integração real sem alterar `paymentService`. O contrato `generatePixCode(purchaseId, value) → string` permite trocar a implementação sem modificar quem consome. |
| `payment-service/resilience/circuitBreaker.js` | Aceita qualquer função assíncrona como parâmetro (`asyncFn`). Nenhuma modificação necessária para envolver uma nova operação com circuit breaker. |

---

## L — Liskov Substitution Principle (LSP)

> Objetos de uma subclasse devem poder substituir objetos da superclasse sem alterar a correção do programa.

**Aplicação:** N/A com justificativa.

O projeto não utiliza herança de classes nem polimorfismo explícito — a stack Node.js/Express com módulos CommonJS foi deliberadamente mantida sem ORM ou abstrações de classe. O princípio não é violado, mas tampouco é exercitado de forma demonstrável.

**Onde poderia ser aplicado no futuro:** Uma hierarquia `NotificationChannel` (interface) com implementações `EmailChannel`, `SMSChannel` e `WebhookChannel` permitiria trocar o canal de notificação sem alterar o `notification-service/index.js`.

---

## I — Interface Segregation Principle (ISP)

> Clientes não devem ser forçados a depender de interfaces que não utilizam.

| Arquivo | Aplicação do ISP |
|---------|-----------------|
| `payment-service/repositories/packageRepository.js` vs `purchaseRepository.js` | Os dois repositórios foram mantidos separados em vez de um único `paymentRepository`. `paymentService` importa apenas `packageRepository.listPackages()` para listar pacotes, sem carregar as funções de `purchaseRepository`. |
| `payment-service/messaging/publisher.js` | Expõe apenas `publishPaymentConfirmed`. `paymentService` importa somente o que precisa — não há métodos de consumo, gerenciamento de exchange ou fila expostos no mesmo módulo. |
| `payment-service/middlewares/auth.js` | Expõe apenas `authMiddleware`. O servidor importa somente a função de validação, sem acesso a funções de geração de token (que pertencem ao `authService`). |

---

## D — Dependency Inversion Principle (DIP)

> Módulos de alto nível não devem depender de módulos de baixo nível. Ambos devem depender de abstrações.

| Arquivo | Aplicação do DIP |
|---------|-----------------|
| `auth-service/repositories/userRepository.js` | Depende de `db.js` (abstração da conexão), não de `pg` diretamente. Trocar o driver de banco de dados exige alterar apenas `db.js`. |
| `auth-service/server.js` | Depende do módulo `authService`, não de `pg`, `bcrypt` ou `jsonwebtoken` diretamente. O controller não conhece a implementação de hashing ou emissão de token. |
| `payment-service/services/paymentService.js` | Depende de abstrações: `packageRepository`, `purchaseRepository`, `pixService` e `createCircuitBreaker`. Não importa `pg`, `opossum` ou `amqplib` diretamente — cada detalhe de implementação está encapsulado nos módulos correspondentes. |

---

## Resumo por Princípio

| Princípio | Status | Arquivos com aplicação explícita |
|-----------|--------|----------------------------------|
| **SRP** | ✅ Amplamente aplicado | 15 ocorrências em 10 arquivos diferentes |
| **OCP** | ✅ Aplicado | 4 ocorrências em 4 arquivos |
| **LSP** | ⚪ N/A | Não violado; sem hierarquias de classe no projeto |
| **ISP** | ✅ Aplicado | 3 ocorrências; repositórios segregados por entidade |
| **DIP** | ✅ Aplicado | 3 ocorrências em 3 arquivos críticos |
