// [SOLID: SRP] — regra de negócio de pagamento isolada da camada HTTP
// [SOLID: DIP] — depende de repositories via import, não de pg diretamente
// [SOLID: OCP] — novo provedor de pagamento (ex: Mercado Pago) substituiria apenas a geração do pixCode sem modificar este service
const { randomUUID } = require('crypto');
const packageRepository = require('../repositories/packageRepository');
const purchaseRepository = require('../repositories/purchaseRepository');

async function listPackages() {
  return packageRepository.listPackages();
}

async function initiatePurchase(userId, packageId, billingData) {
  const pkg = await packageRepository.findById(packageId);
  if (!pkg) {
    const err = new Error('Pacote não encontrado');
    err.status = 404;
    throw err;
  }

  const pixCode = `PIX-${randomUUID()}-${Date.now()}`;
  const purchase = await purchaseRepository.createPurchase({ userId, packageId, billingData, pixCode });

  return { purchaseId: purchase.id, status: 'pending', pixCode };
}

module.exports = { listPackages, initiatePurchase };
