const config = require('./config/env');
const { pool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { ensureInitialAdmin } = require('./services/authService');
const app = require('./app');

async function main() {
  await migrate();
  await ensureInitialAdmin();

  const server = app.listen(config.port, () => {
    console.log(`API no ar na porta ${config.port} (${config.env})`);
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => {
      console.error('Tempo limite ao encerrar a API.');
      process.exit(1);
    }, 30000);
    deadline.unref();
    server.close(async () => {
      try {
        await pool.end();
        clearTimeout(deadline);
        process.exit(0);
      } catch (error) {
        console.error('Falha ao encerrar a API:', error.message);
        process.exit(1);
      }
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});
