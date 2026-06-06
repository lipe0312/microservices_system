const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const creditPackages = [
    { id: 1, name: 'Pacote Básico', credits: 10, price: 19.90 },
    { id: 2, name: 'Pacote Intermediário', credits: 50, price: 79.90 },
    { id: 3, name: 'Pacote Avançado', credits: 100, price: 149.90 }
];

app.post('/payments/checkout', (req, res) => {
    const { packageId, billingData, userId } = req.body;

    const selectedPackage = creditPackages.find(p => p.id === packageId);
    if (!selectedPackage) return res.status(404).json({ error: 'Pacote inválido.' });

    if (!billingData || !billingData.cardNumber || !billingData.cpf) {
        return res.status(400).json({ error: 'Dados financeiros incompletos.' });
    }

    console.log(`[Payment Service] Cobrando R$${selectedPackage.price} do User ID ${userId}`);
    
    // Simulação de transação aprovada
    res.status(200).json({
        status: 'Sucesso',
        message: `Sucesso! O pacote "${selectedPackage.name}" foi processado. ${selectedPackage.credits} créditos foram concedidos ao usuário ID: ${userId}.`
    });
});

app.listen(3002, () => console.log('=> Payment Service ativo na porta 3002'));
