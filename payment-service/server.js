const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middlewares/auth');
const paymentService = require('./services/paymentService');

const app = express();
app.use(express.json());
app.use(cors());

// [SOLID: OCP] — proteção adicionada via middleware sem modificar lógica das rotas
app.get('/payments/packages', async (req, res) => {
  try {
    const packages = await paymentService.listPackages();
    res.status(200).json(packages);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar pacotes.' });
  }
});

app.post('/payments/checkout', authMiddleware, async (req, res) => {
  const { packageId, billingData } = req.body;
  const userId = req.user.userId;

  if (!packageId || !billingData) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
  }

  try {
    const result = await paymentService.initiatePurchase(userId, packageId, billingData);
    res.status(201).json(result);
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: err.message });
    console.error('[Payment Service] Erro no checkout:', err.message);
    res.status(500).json({ error: 'Erro ao processar pagamento.' });
  }
});

app.listen(3002, () => console.log('=> Payment Service ativo na porta 3002'));
