// Backup binário sem redirecionamento do PowerShell, preservando o arquivo pg_dump.
// Uso: node scripts/backup-db.cjs [--compose arquivo.yml] [--env-file arquivo] [--project nome] [--output arquivo.dump]
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { once } = require('node:events');

async function main() {
  const root = path.resolve(__dirname, '..');
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--compose', '--env-file', '--output', '--project'].includes(key) || !process.argv[i + 1])
      throw new Error('Use --compose arquivo, --env-file arquivo, --project nome e/ou --output arquivo.dump.');
    options[key] = process.argv[i + 1];
  }
  const envFile = options['--env-file'] ? path.resolve(options['--env-file']) : path.join(root, '.env');
  if (options['--env-file'] && !fs.existsSync(envFile)) throw new Error('Arquivo de ambiente não encontrado.');
  const file = options['--output'] ? path.resolve(options['--output']) : path.join(root, `backups/doceponto-${new Date().toISOString().replace(/[:.]/g, '-')}.dump`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Criação exclusiva: nunca sobrescreve um backup existente.
  const fd = fs.openSync(file, 'wx', 0o600);
  const output = fs.createWriteStream(file, { fd });
  const args = ['compose'];
  if (options['--project']) args.push('--project-name', options['--project']);
  if (fs.existsSync(envFile)) args.push('--env-file', envFile);
  args.push('-f', options['--compose'] ? path.resolve(options['--compose']) : path.join(root, 'deploy/compose.yml'), 'exec', '-T', 'db', 'sh', '-c',
    'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom');
  const child = spawn('docker', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
