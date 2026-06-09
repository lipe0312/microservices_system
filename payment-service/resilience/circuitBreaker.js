// [SOLID: SRP] — encapsula exclusivamente a lógica de circuit breaker
// [SOLID: OCP] — aceita qualquer função assíncrona sem modificação
const CircuitBreaker = require('opossum');

function createCircuitBreaker(asyncFn, extraOptions = {}) {
  const cb = new CircuitBreaker(asyncFn, {
    timeout: 3000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    ...extraOptions,
  });
  cb.on('open', () => console.warn('[CircuitBreaker] ABERTO — chamadas bloqueadas'));
  cb.on('halfOpen', () => console.warn('[CircuitBreaker] SEMI-ABERTO — testando...'));
  cb.on('close', () => console.warn('[CircuitBreaker] FECHADO — operação normalizada'));
  return cb;
}

module.exports = { createCircuitBreaker };
