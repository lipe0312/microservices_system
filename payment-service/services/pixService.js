// [SOLID: SRP] — responsabilidade única: gerar código PIX simulado
// [SOLID: OCP] — substituível por integração real sem alterar paymentService

function generatePixCode(purchaseId, value) {
  return `PIX${String(purchaseId).padStart(6, '0')}${value.toFixed(2).replace('.', '')}${Date.now()}`;
}

module.exports = { generatePixCode };
