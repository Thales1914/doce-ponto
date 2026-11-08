const router = require('express').Router();
const { pool } = require('../db/pool');

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', banco: 'conectado' });
  } catch {
    res.status(503).json({ status: 'indisponivel', banco: 'desconectado' });
  }
});

router.use('/docs', require('./docsRoutes'));
router.use('/auth', require('./authRoutes'));
router.use('/produtos', require('./produtoRoutes'));
router.use('/estoque', require('./estoqueRoutes'));
router.use('/pedidos', require('./pedidoRoutes'));
router.use('/restaurantes', require('./restauranteRoutes'));
router.use('/vendas-restaurantes', require('./vendaRestauranteRoutes'));
router.use('/financeiro', require('./financeiroRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));

module.exports = router;
