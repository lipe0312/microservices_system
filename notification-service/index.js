// [SOLID: SRP] — responsabilidade única: consumir eventos e notificar
const amqp = require('amqplib');

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function connect() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await amqp.connect(RABBITMQ_URL);
      console.log('[Notification] Conectado ao RabbitMQ');
      return conn;
    } catch (err) {
      console.warn(`[Notification] Tentativa ${attempt}/${MAX_RETRIES} falhou: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  throw new Error('[Notification] Não foi possível conectar ao RabbitMQ após 10 tentativas');
}

async function start() {
  const conn = await connect();
  const channel = await conn.createChannel();

  await channel.assertExchange('payment_events', 'direct', { durable: true });
  await channel.assertExchange('payment.dlx', 'direct', { durable: true });

  await channel.assertQueue('payment.confirmed', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'payment.dlx',
      'x-dead-letter-routing-key': 'payment.confirmed.dlq',
      'x-message-ttl': 5000
    }
  });

  await channel.assertQueue('payment.confirmed.dlq', { durable: true });

  await channel.bindQueue('payment.confirmed', 'payment_events', 'payment.confirmed');
  await channel.bindQueue('payment.confirmed.dlq', 'payment.dlx', 'payment.confirmed.dlq');

  channel.consume('payment.confirmed', (msg) => {
    if (!msg) return;
    try {
      const data = JSON.parse(msg.content.toString());
      console.log(`[EMAIL] Enviando confirmação para ${data.email} — compra ${data.purchaseId}`);
      channel.ack(msg);
    } catch (err) {
      console.error('[Notification] Erro ao processar mensagem:', err.message);
      channel.nack(msg, false, false);
    }
  }, { noAck: false });

  console.log('[Notification] Aguardando mensagens em payment.confirmed');
}

start().catch(err => {
  console.error('[Notification] Erro fatal:', err.message);
  process.exit(1);
});
