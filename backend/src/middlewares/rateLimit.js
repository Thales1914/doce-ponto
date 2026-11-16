const rateLimit = require('express-rate-limit');
const config = require('../config/env');

function limiter({ windowMs, limit, mensagem, skipSuccessfulRequests = false }) {
  return rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (req, res) => {
      res.status(429).json({ erro: { codigo: 'MUITAS_REQUISICOES', mensagem } });
    },
  });
}

const MIN = 60 * 1000;

module.exports = {
  publicWriteLimiter: limiter({ windowMs: 15 * MIN, limit: 30, mensagem: 'Muitas solicitações. Tente novamente em alguns minutos.' }),
  publicReadLimiter: limiter({ windowMs: 15 * MIN, limit: 120, mensagem: 'Muitas consultas. Tente novamente em alguns minutos.' }),
  // Força bruta no login: só tentativas recusadas contam, então quem acerta a senha
  // não fica bloqueado por ter entrado várias vezes ou errado uma ou duas antes.
  loginLimiter: limiter({
    windowMs: 15 * MIN,
    limit: 10,
    skipSuccessfulRequests: true,
    mensagem: 'Muitas tentativas de login com dados incorretos. Aguarde 15 minutos e confira o e-mail e a senha.',
  }),
};
