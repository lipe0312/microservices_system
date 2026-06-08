# ESTADO_ATUAL — Trabalho III (Veridit) · Eng. Software I / BCC-UFBA

> Gerado em: 2026-06-07  
> Branch analisada: `refactor/t3-alinhamento-grupo2`  
> Repositório: `microservices_system`

---

## 1. Raio-X da Implementação Atual

### 1.1 Mapeamento de Arquivos → Componentes

| Arquivo | Componente Arquitetural | Observação |
|---|---|---|
| `auth-service/server.js` | **Auth Service** | Único arquivo de implementação |
| `auth-service/package.json` | Auth Service | Dependências: express, bcryptjs, jsonwebtoken, cors |
| `auth-service/Dockerfile` | Auth Service | Node 18-alpine, porta 3001 |
| `payment-service/server.js` | **Processador de Pagamentos** | Inclui catálogo de preços embutido |
| `payment-service/package.json` | Processador de Pagamentos | Dependências: express, cors apenas |
| `payment-service/Dockerfile` | Processador de Pagamentos | Node 18-alpine, porta 3002 |
| `docker-compose.yml` | Infraestrutura / Orquestração | auth-service, payment-service, db_auth, db_payment |
| `login.html` | **Front-end** | Chama `localhost:3001/auth/login` |
| `cadastro.html` | **Front-end** | Chama `localhost:3001/auth/register` |
| `creditos.html` | **Front-end** (Catálogo de Preços visual) | Não consome API; pacotes hardcoded no HTML |
| `checkout.html` | **Front-end** (Mecanismo de Captura visual) | **NÃO chama o payment-service**; exibe `alert()` |

**Componentes exigidos pela arquitetura do Grupo 2 que estão AUSENTES:**
- API Gateway
- Mecanismo de Captura (backend real — o HTML é só UI)
- Catálogo de Preços (serviço separado)
- Gestor de Metadados
- Processador de Mídia
- Message Broker (RabbitMQ / Kafka)
- Circuit Breaker
- Dead-Letter Queue

### 1.2 Stack Tecnológica

- **Runtime:** Node.js 18 (LTS)
- **Framework HTTP:** Express.js 4.x
- **Auth:** bcryptjs 2.x + jsonwebtoken 9.x
- **Containerização:** Docker (imagem node:18-alpine) + Docker Compose 3.8
- **Banco de Dados:** PostgreSQL 15 — **declarado no `docker-compose.yml` mas nunca conectado pelos serviços**
- **Frontend:** HTML/CSS/JS puro, sem framework

### 1.3 Status por Componente

| Componente | Status | Detalhe |
|---|---|---|
| Auth Service — Registro | Parcialmente funcional | Funciona em memória; dados perdidos ao reiniciar container |
| Auth Service — Login / JWT | Parcialmente funcional | Gera JWT, mas `JWT_SECRET = 'super_secret_key_faculdade'` hardcoded |
| Auth Service — PostgreSQL | **AUSENTE** | `DATABASE_URL` env var declarada no compose, completamente ignorada no código |
| Payment Service — Checkout | **Esqueleto** | Endpoint existe, mas nenhuma camada de persistência nem validação de token |
| Payment Service — Catálogo | Incompleto | Pacotes hardcoded no array `creditPackages` (linha 8–12 de `payment-service/server.js`) |
| Frontend — Login/Cadastro | Funcional (demo) | Possui fallback simulado que ignora erros de rede (`catch` → mock-token) |
| Frontend — Creditos | Visual apenas | Não consome API de catálogo |
| Frontend — Checkout | **Quebrado** | `finalizarPedido()` (linha 114–118 de `checkout.html`) exibe apenas `alert()` e redireciona sem chamar o backend |
| API Gateway | **AUSENTE** | — |
| Message Broker | **AUSENTE** | — |
| Circuit Breaker | **AUSENTE** | — |
| DLQ | **AUSENTE** | — |
| Escalonamento horizontal | **AUSENTE** | `docker-compose.yml` não define `replicas` |

---

## 2. Aderência à Arquitetura — O Bom e o Ruim

### 2.1 Microsserviços ou Monólito Disfarçado?

Os dois serviços existem como processos separados com Dockerfiles independentes e bancos de dados declarados individualmente — isso é correto **na forma**. Contudo:

- Não há comunicação inter-serviços (auth-service e payment-service são ilhas isoladas).
- O frontend acessa os serviços diretamente com URLs `localhost:3001` / `localhost:3002`, acoplando o cliente à topologia interna — o que elimina qualquer benefício do isolamento.
- O payment-service **não valida o JWT emitido pelo auth-service** (linha 14–31 de `payment-service/server.js` — nenhuma verificação de `Authorization` header), tornando o endpoint de pagamento completamente público.

**Conclusão:** Arquitetura de microsserviços na configuração de infraestrutura, mas com falha total de integração e segurança entre os serviços.

### 2.2 Táticas Obrigatórias — O Que Foi (e O Que Não Foi) Implementado

| Tática | Status | Evidência no Código |
|---|---|---|
| Circuit Breaker | **Ausente** | Nenhuma biblioteca (opossum, etc.) instalada |
| Retry com Exponential Backoff | **Ausente** | Nenhum mecanismo de retry em nenhum arquivo |
| Dead-Letter Queue | **Ausente** | Sem broker, sem fila |
| Message Broker assíncrono | **Ausente** | Toda comunicação é síncrona HTTP ou inexistente |
| API Gateway | **Ausente** | Frontend chama backends diretamente |
| Escalonamento horizontal | **Ausente** | Sem `replicas`, sem load balancer no compose |
| Serviços stateless | **Violado** | `auth-service/server.js:11` — `const users = []` é estado em memória |

### 2.3 Violações Arquiteturais Concretas

1. **`auth-service/server.js` linha 11** — `const users = [];`  
   Estado persistido em memória viola o requisito de serviços stateless. Qualquer restart do container apaga todos os usuários.

2. **`auth-service/server.js` linha 10** — `const JWT_SECRET = 'super_secret_key_faculdade';`  
   Segredo hardcoded no código. Deve vir de variável de ambiente (`process.env.JWT_SECRET`).

3. **`docker-compose.yml` linhas 9, 20** — `DATABASE_URL` declarada, mas ignorada pelos serviços.  
   O PostgreSQL sobe, mas nenhum serviço conecta. Isso é infraestrutura morta.

4. **`checkout.html` linhas 114–118** — `finalizarPedido()` não chama o payment-service.  
   O fluxo de pagamento é uma simulação client-side. O endpoint `POST /payments/checkout` existe no backend mas nunca é invocado.

5. **`login.html` linhas 78–83** — Fallback silencioso com mock-token.  
   Em caso de erro de rede, o sistema autentica o usuário com um token falso sem nenhum aviso. Isso é uma vulnerabilidade de segurança ativa na demo.

6. **`payment-service/server.js` linha 14** — Endpoint `/payments/checkout` sem autenticação.  
   Qualquer cliente pode processar um pagamento sem estar autenticado.

---

## 3. Auditoria SOLID

### SRP — Single Responsibility Principle

**Violado em ambos os serviços.**

- `auth-service/server.js` (42 linhas) é responsável por: (1) configuração do servidor HTTP, (2) roteamento, (3) hashing de senha, (4) geração de JWT, (5) persistência de usuários. Cinco responsabilidades em um arquivo.
- `payment-service/server.js` (33 linhas) é responsável por: (1) configuração HTTP, (2) roteamento, (3) definição do catálogo de produtos, (4) lógica de validação do pedido, (5) simulação de transação.

**Solução:** Separar em classes/módulos: `UserRepository`, `AuthService`, `TokenService`, `AuthRouter`; e `PackageCatalog`, `PaymentProcessor`, `CheckoutRouter`.

### OCP — Open/Closed Principle

**Violado no `payment-service/server.js` linhas 8–12.**

```js
const creditPackages = [
    { id: 1, name: 'Pacote Básico', credits: 10, price: 19.90 },
    ...
];
```

O catálogo de produtos está embutido no código. Adicionar ou remover um pacote exige modificar o serviço e fazer novo deploy. O correto seria expor o catálogo via banco de dados ou um serviço dedicado (Catálogo de Preços), tornando o código aberto para extensão sem modificação.

### LSP — Liskov Substitution Principle

**Não aplicável no estado atual** — não há hierarquia de classes ou polimorfismo implementado. A ausência de qualquer abstração é em si um problema, mas não uma violação de LSP.

### ISP — Interface Segregation Principle

**Parcialmente violado no contrato da API.**

O endpoint `POST /payments/checkout` recebe `{ packageId, billingData, userId }` onde `billingData` contém `{ cardNumber, cpf }` — mas o endpoint também deve suportar PIX (sem `cardNumber`). O código na linha 20 exige ambos os campos para qualquer modalidade, rejeitando pagamentos PIX sem cartão. Não há segregação de interface por modalidade de pagamento.

### DIP — Dependency Inversion Principle

**Violado nos dois serviços.**

- `auth-service/server.js:11` — A camada de roteamento depende diretamente de `users[]` (array concreto), sem abstração de repositório.
- `payment-service/server.js:8` — A camada de roteamento depende diretamente de `creditPackages[]` (dado concreto embutido), sem abstração de catálogo.

Nenhum dos serviços usa injeção de dependência. O correto seria depender de interfaces/abstrações (`IUserRepository`, `IPackageCatalog`) cujas implementações concretas seriam injetadas.

### Pontos Críticos de Violação SOLID (mínimo 3)

**Violação 1 — SRP crítico: `auth-service/server.js` (arquivo inteiro)**  
Problema: Roteamento HTTP, lógica de negócio, criptografia e persistência de dados coexistem no mesmo arquivo de 42 linhas.  
Solução: Criar `src/routes/authRouter.js`, `src/services/authService.js`, `src/repositories/userRepository.js`, `src/services/tokenService.js`.

**Violação 2 — DIP crítico: banco de dados ignorado**  
Problema: O `auth-service` declara `DATABASE_URL` via Docker mas usa `const users = []`. A dependência concreta (array em memória) está diretamente instanciada no módulo principal, sem possibilidade de substituição por implementação real (PostgreSQL) sem alterar o código de negócio.  
Solução: Criar interface `IUserRepository` e duas implementações: `InMemoryUserRepository` (para testes) e `PostgresUserRepository` (para produção), injetadas via variável de ambiente.

**Violação 3 — OCP + SRP crítico: catálogo de preços embutido no serviço de pagamento**  
Problema: `payment-service/server.js` linhas 8–12 definem o catálogo de produtos diretamente no servidor de pagamentos. Isso viola SRP (o serviço de pagamentos não deveria conhecer o catálogo) e OCP (qualquer mudança de preço exige modificar e reimplantar o serviço de pagamentos).  
Solução: Extrair para um `price-catalog-service` independente com seu próprio banco de dados, expondo `GET /catalog/packages`. O payment-service consulta esse endpoint (ou consome evento de catálogo via broker).

---

## 4. Alvo dos 30% — Plano de Sprint

> Prazo: apresentações nos dias **04 e 09 de junho de 2026**.  
> O sistema Veridit é uma plataforma de autenticação/verificação de documentos jurídicos com créditos pré-pagos.

### Requisitos Priorizados

| Prioridade | Requisito (estimado) | Justificativa | Esforço |
|---|---|---|---|
| 🔴 P1 | **REQ01 — Cadastro de Usuário** | 70% pronto (endpoint existe); falta apenas conectar ao PostgreSQL e remover in-memory | Baixo |
| 🔴 P1 | **REQ02 — Login e Autenticação JWT** | 70% pronto; falta mover `JWT_SECRET` para env var e validar token no payment-service | Baixo |
| 🔴 P1 | **REQ03 — Compra de Créditos (fluxo completo)** | `checkout.html` existe mas não chama backend; conectar ao `/payments/checkout` é a mudança mais visível para a demo | Médio |
| 🟡 P2 | **REQ04 — Catálogo de Pacotes de Créditos** | Pacotes existem hardcoded; extrair para endpoint `GET /payments/packages` ou serviço separado é rápido e demonstra modularidade | Baixo |
| 🟡 P2 | **REQ05 — Proteção de Endpoints por JWT** | Adicionar middleware de validação de token no payment-service demonstra segurança e integração entre serviços | Baixo |
| 🟢 P3 | **REQ06 — Resiliência (Circuit Breaker básico)** | Adicionar `opossum` no payment-service para chamadas externas (mesmo simuladas) demonstra a tática obrigatória ao professor | Médio |

### Estratégia para a Demonstração

A demo mais impactante é o **fluxo ponta-a-ponta**: `Cadastro → Login → Visualizar Pacotes → Checkout → Confirmação`. Esse fluxo já existe visualmente; o trabalho é torná-lo funcional e rastreável:

1. Corrigir auth-service para persistir em PostgreSQL (REQ01/REQ02) — dados sobrevivem ao restart.
2. Conectar `checkout.html` ao `POST /payments/checkout` com token JWT no header (REQ03/REQ05).
3. Adicionar endpoint `GET /payments/packages` e fazer `creditos.html` consumi-lo (REQ04).
4. Adicionar um circuit breaker simbólico no payment-service (REQ06) — mesmo que a "dependência externa" seja simulada.

Esses 4 passos cobrem **3 componentes arquiteturais visíveis** (Auth, Pagamentos, Frontend), demonstram **2 táticas** (JWT entre serviços + circuit breaker), e podem ser apresentados ao vivo num fluxo de 2 minutos.

---

## 5. Necessidade de ADR — Alertas de Desvio

### ADR-001 — Frontend Estático com Fallback de Mock

**O que foi decidido no código:** `login.html` lines 78–83 implementam um fallback silencioso: se o backend estiver inacessível, o usuário é autenticado com um `mock-token` falso e redirecionado normalmente.

**O que a arquitetura exigia:** Frontend acoplado ao Auth Service via API Gateway, com tratamento de erro explícito e sem bypass de autenticação.

**Sugestão de ADR:**  
> **Título:** "ADR-001: Fallback Simulado no Frontend para Demonstração Visual"  
> **Justificativa:** Necessidade de validar fluxo visual sem infraestrutura Docker ativa durante desenvolvimento. Deve ser removido antes da entrega final.

---

### ADR-002 — Persistência em Memória no Auth Service

**O que foi decidido no código:** `auth-service/server.js:11` — `const users = [];` substitui o PostgreSQL configurado no docker-compose.

**O que a arquitetura exigia:** Serviço stateless com banco de dados externo; estado de usuários no PostgreSQL (`db_auth`).

**Sugestão de ADR:**  
> **Título:** "ADR-002: Substituição Temporária do PostgreSQL por Armazenamento em Memória no Auth Service"  
> **Justificativa:** Redução de complexidade na iteração inicial. Classificada como dívida técnica crítica a ser quitada antes da Sprint 2.

---

### ADR-003 — Ausência de API Gateway

**O que foi decidido no código:** Frontend acessa `http://localhost:3001` e `http://localhost:3002` diretamente (hardcoded em `login.html:64`, `cadastro.html:141`, implícito em `checkout.html`).

**O que a arquitetura exigia:** Um API Gateway centralizando o roteamento externo, ocultando a topologia interna dos serviços, e sendo o único ponto de entrada para o frontend.

**Sugestão de ADR:**  
> **Título:** "ADR-003: Acesso Direto ao Backend — Ausência de API Gateway na Sprint 1"  
> **Justificativa:** Gateway (nginx/traefik) adiado para sprint seguinte por não ser bloqueante para demonstração do fluxo funcional. Risco: mudanças de porta ou host exigem alterações no código frontend.

---

### ADR-004 — Comunicação Síncrona no Fluxo de Pagamento

**O que foi decidido no código:** O fluxo de pagamento é uma chamada HTTP síncrona direta (ou nem isso — atualmente é uma simulação client-side). Não há mensageria assíncrona.

**O que a arquitetura exigia:** Desacoplamento via Message Broker para o processamento de pagamentos, com filas DLQ para falhas.

**Sugestão de ADR:**  
> **Título:** "ADR-004: Processamento de Pagamentos Síncrono — Ausência de Message Broker na Sprint 1"  
> **Justificativa:** A complexidade de configurar RabbitMQ/Kafka e o padrão produtor/consumidor foi postergada. O risco é que falhas no pagamento não tenham mecanismo de reprocessamento. Deve ser introduzido antes da entrega final para demonstrar a tática obrigatória de DLQ.

---

*Fim do documento. Próximos passos recomendados: corrigir as violações P1 acima, criar as ADRs no diretório `docs/adr/`, e adicionar dependências `pg` (PostgreSQL client) e `opossum` (circuit breaker) nos `package.json` antes das apresentações.*