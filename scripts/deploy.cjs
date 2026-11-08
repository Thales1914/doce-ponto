const { spawnSync } = require('node:child_process');
const { checkDeploy } = require('./check-deploy.cjs');
try {
  const { root, file, env } = checkDeploy();
  const result = spawnSync('docker', [
    'compose', '--env-file', file, '-f', 'docker-compose.production.yml',
    'up', '-d', '--build', '--wait', '--wait-timeout', '180',
  ], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('O deploy não concluiu. Consulte os logs do Docker Compose.');
  console.log(`Serviços iniciados. Confira o acesso público em ${env.PUBLIC_ORIGIN}.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
