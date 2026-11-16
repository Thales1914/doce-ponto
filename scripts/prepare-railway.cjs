const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { randomBytes } = require('node:crypto');
const { initialAdmin } = require('../backend/src/validators/authSchemas');
const { validateProductionEnv } = require('../backend/src/config/production');

function prepareRailway({ email = 'admin@doceponto.local', directory = path.resolve(__dirname, '..') } = {}) {
  const backend = {
    NODE_ENV: 'production', PORT: '3000',
    DATABASE_URL: '${{Postgres.DATABASE_URL}}',
    JWT_SECRET: randomBytes(48).toString('hex'), JWT_EXPIRES_IN: '8h',
    ADMIN_NOME: 'Administradora', ADMIN_EMAIL: email,
    ADMIN_SENHA: randomBytes(18).toString('base64url'),
    APP_TIMEZONE: 'America/Sao_Paulo', TRUST_PROXY: '1',
    CORS_ORIGIN: 'https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}',
  };
  const frontend = { PORT: '8080', API_UPSTREAM: '${{backend.RAILWAY_PRIVATE_DOMAIN}}:3000' };
  initialAdmin.parse({ nome: backend.ADMIN_NOME, email, senha: backend.ADMIN_SENHA });
  // A origem real só existe depois de gerar o domínio no painel do Railway.
  validateProductionEnv({ ...backend, PUBLIC_ORIGIN: 'https://doceponto.up.railway.app' });
  const files = [
    [path.join(directory, '.env.railway.backend'), backend],
    [path.join(directory, '.env.railway.frontend'), frontend],
  ];
  if (files.some(([file]) => fs.existsSync(file))) {
    throw new Error('Os arquivos Railway já existem e foram preservados. Edite-os para atualizar a configuração.');
  }
  for (const [file, values] of files) {
    const lines = Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
    fs.writeFileSync(file, '# Somente local. Cole no Raw Editor do serviço correspondente no Railway.\n' + lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  }
  return files.map(([file]) => file);
}

module.exports = { prepareRailway };
if (require.main === module) {
  try {
    const { values } = parseArgs({ options: { email: { type: 'string' } } });
    prepareRailway({ email: values.email });
    console.log('Criados .env.railway.backend e .env.railway.frontend, fora do Git.');
    console.log('A senha inicial está em ADMIN_SENHA no arquivo .env.railway.backend.');
    console.log('No Railway, use os nomes Postgres, backend e frontend para resolver as referências.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
