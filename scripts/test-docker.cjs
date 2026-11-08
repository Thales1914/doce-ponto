const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const project = `doceponto-test-${randomBytes(6).toString('hex')}`;
const base = ['compose', '-p', project, '-f', 'deploy/compose.test.yml'];
function docker(args) {
  const result = spawnSync('docker', [...base, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Docker encerrou com código ${result.status}.`);
}
try {
  docker(['run', '--build', '--rm', 'backend']);
  docker(['run', '--build', '--rm', 'frontend']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // O nome aleatório acima identifica exclusivamente os recursos desta execução.
  try { docker(['down', '--volumes', '--remove-orphans']); }
  catch (error) { console.error(`Limpeza de ${project}: ${error.message}`); process.exitCode = 1; }
}
