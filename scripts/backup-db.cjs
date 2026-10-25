// Backup binário sem redirecionamento do PowerShell, preservando o arquivo pg_dump.
// Uso: node scripts/backup-db.cjs [--compose arquivo.yml] [--env-file arquivo] [--output arquivo.dump]
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { once } = require('node:events');

async function main() {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--compose', '--env-file', '--output'].includes(key) || !process.argv[i + 1])
      throw new Error('Use --compose arquivo, --env-file arquivo e/ou --output arquivo.dump.');
    options[key] = process.argv[i + 1];
  }
  const file = path.resolve(options['--output'] || `backups/doceponto-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Criação exclusiva: nunca sobrescreve um backup existente.
  const fd = fs.openSync(file, 'wx', 0o600);
  const output = fs.createWriteStream(file, { fd });
  const args = ['compose'];
  if (options['--env-file']) args.push('--env-file', options['--env-file']);
  args.push('-f', options['--compose'] || 'docker-compose.yml', 'exec', '-T', 'db', 'sh', '-c',
    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom');
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let stderr = '';
  child.stderr.on('data', value => { stderr = (stderr + value).slice(-4000); });
  try {
    const [, [code]] = await Promise.all([pipeline(child.stdout, output), once(child, 'close')]);
    if (code !== 0) throw new Error(stderr.trim() || 'pg_dump não concluiu o backup.');
    const header = Buffer.alloc(5);
    const check = fs.openSync(file, 'r');
    try { fs.readSync(check, header, 0, 5, 0); } finally { fs.closeSync(check); }
    if (header.toString() !== 'PGDMP') throw new Error('Arquivo de backup inválido.');
    console.log(`Backup criado: ${file}`);
  } catch (error) {
    child.kill();
    output.destroy();
    await fs.promises.rm(file, { force: true }).catch(() => {});
    throw error;
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
