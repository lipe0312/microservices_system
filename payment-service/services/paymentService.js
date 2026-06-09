// [SOLID: SRP] — regra de negócio de pagamento isolada da camada HTTP
// [SOLID: DIP] — depende de abstrações (pixService, circuitBreaker), não implementações diretas
// [SOLID: OCP] — novo provedor de pagamento (ex: Mercado Pago) substituiria apenas pixService sem modificar este service
const packageRepository = require('../repositories/packageRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const pixService = require('./pixService');
const { createCircuitBreaker } = require('../resilience/circuitBreaker');
const { publishPaymentConfirmed } = require('../messaging/publisher');

// Função que encapsula todas as operações de banco do checkout
// [SOLID: SRP] — isolada para permitir circuit breaker sobre todo o fluxo de DB
async function dbCheckout({ userId, packageId, billingData }) {
  const pkg = await packageRepository.findById(packageId);
  if (!pkg) {
    const err = new Error('Pacote não encontrado');
    err.status = 404;
    throw err;
  }
  const valorTotal = parseFloat(pkg.valor_por_credito) * parseInt(pkg.quantidade_creditos, 10);
  const pixCode = pixService.generatePixCode(packageId, valorTotal);
  const purchase = await purchaseRepository.createPurchase({ userId, packageId, billingData, pixCode });
  return { purchase, pixCode };
}

// Singleton — estado do circuit breaker persiste entre chamadas
// errorFilter: erros de negócio (404) não contam como falha de infraestrutura
const checkoutBreaker = createCircuitBreaker(dbCheckout, {
  errorFilter: (err) => err.status === 404,
});

async function listPackages() {
  return packageRepository.listPackages();
}

async function initiatePurchase(userId, packageId, billingData) {
  let result;
  try {
    result = await checkoutBreaker.fire({ userId, packageId, billingData });
  } catch (cbErr) {
    if (cbErr.status === 404) throw cbErr;
    const err = new Error('Serviço temporariamente indisponível.');
    err.status = 503;
    throw err;
  }

  const { purchase, pixCode } = result;

  try {
    await publishPaymentConfirmed({
      purchaseId: purchase.id,
      email: billingData?.email ?? 'usuario@veridit.com',
      packageId
    });
  } catch (pubErr) {
    console.warn('[Publisher] Falha ao publicar evento — pagamento já gravado:', pubErr.message);
  }

  return { purchaseId: purchase.id, status: 'pending', pixCode };
}

module.exports = { listPackages, initiatePurchase };
