// [SOLID: SRP] — responsabilidade única: publicar eventos de pagamento
const amqp = require('amqplib');

async function publishPaymentConfirmed(purchaseData) {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();

  await channel.assertExchange('payment_events', 'direct', { durable: true });

  channel.publish(
    'payment_events',
    'payment.confirmed',
    Buffer.from(JSON.stringify(purchaseData)),
    { persistent: true }
  );

  await channel.close();
  await conn.close();
}

module.exports = { publishPaymentConfirmed };
