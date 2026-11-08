const AppError = require('./AppError');

// NUMERIC(12,2): até dez algarismos inteiros, sem perda no cálculo em centavos.
const MAX_CENTAVOS = 999_999_999_999;

function totalItens(itens) {
  const centavos = itens.reduce((total, item) =>
    total + Math.round(item.preco_unitario * 100) * item.quantidade, 0);
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > MAX_CENTAVOS) {
    throw AppError.badRequest('O valor total excede o limite de R$ 9.999.999.999,99.');
  }
  return centavos / 100;
}

module.exports = { totalItens };
