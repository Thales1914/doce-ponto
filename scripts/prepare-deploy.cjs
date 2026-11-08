const { parseArgs } = require('node:util');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { initialAdmin } = require('../src/validators/authSchemas');
const { validateProductionEnv } = require('../src/config/production');

try {
  const { values } = parseArgs({ options: {
    origin: { type: 'string' }, email: { type: 'string' }, nome: { type: 'string', default: 'Administradora' },
  } });
  if (!values.origin || !values.email) throw new Error('Uso: npm run deploy:prepare -- --origin https://seu-dominio.com --email seu-email');
  const config = {
    POSTGRES_USER: 'doceponto', POSTGRES_DB: 'doceponto',
    POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
    JWT_SECRET: randomBytes(48).toString('hex'), JWT_EXPIRES_IN: '8h',
    ADMIN_NOME: values.nome, ADMIN_EMAIL: values.email,
    ADMIN_SENHA: randomBytes(18).toString('base64url'),
    PUBLIC_ORIGIN: values.origin, HTTP_PORT: '80', HTTPS_PORT: '443',
  };
  validateProductionEnv(config);
  initialAdmin.parse({ nome: config.ADMIN_NOME, email: config.ADMIN_EMAIL, senha: config.ADMIN_SENHA });
  const file = path.resolve(__dirname, '../.env.production');
  const lines = Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  fs.writeFileSync(file, '# Credenciais exclusivas de produção. Não enviar ao Git.\n' + lines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Arquivo .env.production criado. A senha inicial está em ADMIN_SENHA nesse arquivo.');
  console.log('Execute npm run deploy:check antes de publicar.');
} catch (error) {
  console.error(error.code === 'EEXIST' ? '.env.production já existe e foi preservado.' : error.message);
  process.exitCode = 1;
}
