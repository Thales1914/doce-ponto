const { Pool, types } = require('pg');
const config = require('../config/env');

// Valores NUMERIC deste domínio usam centavos; DATE permanece sem conversão de fuso.
types.setTypeParser(1700, Number);
types.setTypeParser(1082, (value) => value);
types.setTypeParser(20, Number);

// O fuso é enviado na abertura da conexão, antes de qualquer consulta.
new Intl.DateTimeFormat('pt-BR', { timeZone: config.timezone });
if (!/^[A-Za-z0-9_+/-]+$/.test(config.timezone)) throw new Error('APP_TIMEZONE inválido.');
const pool = new Pool({
  ...config.db, connectionTimeoutMillis: 5000,
  options: `-c timezone=${config.timezone}`,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err.message);
});

/** Executa `fn(client)` dentro de uma transação (commit ao final, rollback em erro). */
async function withTransaction(fn, { readOnly = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
