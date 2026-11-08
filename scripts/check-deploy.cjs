const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { spawnSync } = require('node:child_process');
const { initialAdmin } = require('../src/validators/authSchemas');
const { validateProductionEnv } = require('../src/config/production');
function checkDeploy() {
  const root = path.resolve(__dirname, '..');
  const file = path.join(root, '.env.production');
  if (!fs.existsSync(file)) throw new Error('Crie .env.production com npm run deploy:prepare ou com deploy/production.env.example.');
  const config = parseEnv(fs.readFileSync(file, 'utf8'));
  validateProductionEnv(config);
  initialAdmin.parse({ nome: config.ADMIN_NOME, email: config.ADMIN_EMAIL, senha: config.ADMIN_SENHA });
  for (const key of ['POSTGRES_USER', 'POSTGRES_DB']) {
    if (!config[key] || !/^[a-z_][a-z0-9_]*$/.test(config[key])) throw new Error(`${key}: use letras minúsculas, números e sublinhado.`);
  }
  // Mesmos valores no validador e no Compose, mesmo se o shell tiver variáveis homônimas.
  const result = spawnSync('docker', ['compose', '--env-file', file, '-f', 'docker-compose.production.yml', 'config', '--quiet'], {
    cwd: root, env: { ...process.env, ...config }, stdio: 'inherit', windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Configuração do Docker Compose inválida.');
  console.log('Configuração válida. Antes de iniciar, confirme o DNS do domínio e as portas 80 e 443 no servidor.');
  return { root, file, env: { ...process.env, ...config } };
}
module.exports = { checkDeploy };
if (require.main === module) {
  try { checkDeploy(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
