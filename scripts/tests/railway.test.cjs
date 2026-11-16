const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { prepareRailway } = require('../prepare-railway.cjs');

test('Railway gera credenciais exclusivas, referências privadas e preserva arquivos existentes', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'doceponto-railway-test-'));
  try {
    const [backendFile, frontendFile] = prepareRailway({ directory });
    const saved = fs.readFileSync(backendFile, 'utf8');
    const backend = parseEnv(saved);
    const frontend = parseEnv(fs.readFileSync(frontendFile, 'utf8'));
    assert.equal(backend.ADMIN_EMAIL, 'admin@doceponto.local');
    assert.equal(backend.DATABASE_URL, '${{Postgres.DATABASE_URL}}');
    assert.equal(backend.CORS_ORIGIN, 'https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}');
    assert.equal(frontend.API_UPSTREAM, '${{backend.RAILWAY_PRIVATE_DOMAIN}}:3000');
    assert.ok(backend.ADMIN_SENHA.length >= 24);
    assert.ok(backend.JWT_SECRET.length >= 64);
    assert.notEqual(backend.ADMIN_SENHA, backend.JWT_SECRET);
    assert.throws(() => prepareRailway({ directory }), /preservados/);
    assert.equal(fs.readFileSync(backendFile, 'utf8'), saved);
    fs.unlinkSync(backendFile);
    fs.unlinkSync(frontendFile);
    prepareRailway({ directory });
    const other = parseEnv(fs.readFileSync(backendFile, 'utf8'));
    assert.notEqual(other.ADMIN_SENHA, backend.ADMIN_SENHA);
    assert.notEqual(other.JWT_SECRET, backend.JWT_SECRET);
  } finally {
    // Somente os arquivos conhecidos dentro do diretório criado por este teste.
    for (const name of ['.env.railway.backend', '.env.railway.frontend']) {
      const file = path.join(directory, name);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    fs.rmdirSync(directory);
  }
});
