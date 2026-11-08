// Exercita as imagens finais em HTTPS, com banco e certificados descartáveis.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const https = require('node:https');
const root = path.resolve(__dirname, '..');
const project = `doceponto-smoke-${randomBytes(6).toString('hex')}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'doceponto-smoke-'));
const env = {
  ...process.env,
  POSTGRES_USER: 'smoke', POSTGRES_DB: 'smoke',
  POSTGRES_PASSWORD: randomBytes(24).toString('hex'),
  JWT_SECRET: randomBytes(48).toString('hex'), JWT_EXPIRES_IN: '8h',
  ADMIN_NOME: 'Admin Smoke', ADMIN_EMAIL: 'admin@smoke.local',
  ADMIN_SENHA: randomBytes(18).toString('hex'),
  PUBLIC_ORIGIN: 'https://localhost', HTTP_PORT: '127.0.0.1:0', HTTPS_PORT: '127.0.0.1:0',
};
const compose = ['compose', '-p', project, '-f', 'docker-compose.production.yml'];
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} falhou.`);
  return result.stdout?.trim();
}
const docker = (args, options) => run('docker', [...compose, ...args], options);
const pause = () => new Promise(resolve => setTimeout(resolve, 1000));
let agent, port;
function request(route, { method = 'GET', body, token, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'localhost', port, path: route, method, agent, headers: {
      ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers,
    } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let data; try { data = JSON.parse(text); } catch { data = text; }
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Timeout HTTP.')));
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
}
async function main() {
  try {
    const config = JSON.parse(docker(['config', '--format', 'json']));
    assert.equal(config.services.db.ports, undefined);
    assert.equal(config.services.api.ports, undefined);
    docker(['up', '-d', '--build', '--wait', '--wait-timeout', '180'], { stdio: 'inherit' });
    port = Number(docker(['port', 'frontend', '443']).split(':').at(-1));
    const httpPort = Number(docker(['port', 'frontend', '80']).split(':').at(-1));
    const certificate = path.join(temp, 'root.crt');
    docker(['cp', 'frontend:/data/caddy/pki/authorities/local/root.crt', certificate]);
    agent = new https.Agent({ ca: fs.readFileSync(certificate), keepAlive: false });
    const redirect = await fetch(`http://localhost:${httpPort}/`, { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.match(redirect.headers.get('location'), /^https:\/\/localhost/);
    for (const route of ['/', '/admin/login', '/admin/dashboard', '/acompanhar']) {
      const page = await request(route);
      assert.equal(page.status, 200, route);
      assert.match(page.data, /<div id="root">/);
      assert.equal(page.headers['x-content-type-options'], 'nosniff');
      assert.equal(page.headers['cache-control'], 'no-cache');
    }
    const html = (await request('/')).data;
    const asset = html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
    assert.match((await request(asset)).headers['cache-control'], /immutable/);
    assert.equal((await request('/assets/arquivo-inexistente.js')).status, 404);
    assert.equal((await request('/api/health/ready')).data.banco, 'conectado');
    assert.equal((await request('/api/auth/me')).status, 401);
    assert.equal((await request('/api/docs/')).status, 200);
    const login = await request('/api/auth/login', { method: 'POST', body: { email: env.ADMIN_EMAIL, senha: env.ADMIN_SENHA } });
    assert.equal(login.status, 200);
    assert.equal(login.headers['cache-control'], 'no-store');
    const token = login.data.token;
    assert.equal((await request('/api/auth/me', { token })).data.email, env.ADMIN_EMAIL);
    const product = await request('/api/produtos', { method: 'POST', token, body: { nome: 'Produto Smoke', preco: 3.5, quantidade_disponivel: 10 } });
    assert.equal(product.status, 201);
    const order = await request('/api/pedidos', { method: 'POST', body: { cliente: { nome: 'Cliente Smoke', contato: '11988887777' }, itens: [{ produto_id: product.data.id, quantidade: 2 }] } });
    assert.equal(order.status, 201);
    const tracking = await request(`/api/pedidos/${order.data.numero_pedido}`);
    assert.equal(tracking.data.status, 'solicitado');
    assert.equal(tracking.data.total, 7);
    const list = await request('/api/pedidos', { token });
    assert.equal((await request(`/api/pedidos/${list.data.data[0].id}/status`, { method: 'PUT', token, body: { status: 'confirmado' } })).status, 200);
    assert.equal((await request('/api/dashboard/resumo', { token })).data.pendencias.total, 7);
    // Cabeçalhos enviados pelo cliente não podem contornar a limitação de login.
    for (let i = 0; i < 10; i++) {
      const bad = await request('/api/auth/login', { method: 'POST', body: { email: env.ADMIN_EMAIL, senha: 'incorreta' }, headers: { 'X-Forwarded-For': `192.0.2.${i + 1}` } });
      assert.equal(bad.status, i === 9 ? 429 : 401);
    }
    docker(['exec', '-T', 'api', 'node', '-e', "if(require('fs').existsSync('/app/tests')||require('fs').existsSync('/app/.env'))process.exit(1)"]);
    docker(['restart', 'api']);
    let recovered = false;
    for (let i = 0; i < 30; i++) {
      if ((await request('/api/health/ready')).status === 200) { recovered = true; break; }
      await pause();
    }
    assert.ok(recovered, 'API não recuperou após reinício.');
    assert.equal((await request('/api/auth/me', { token })).status, 200);
    assert.equal((await request(`/api/pedidos/${order.data.numero_pedido}`)).data.status, 'confirmado');
    const dump = path.join(temp, 'backup.dump');
    run(process.execPath, ['scripts/backup-db.cjs', '--project', project, '--compose', 'docker-compose.production.yml', '--output', dump]);
    docker(['exec', '-T', 'db', 'createdb', '-U', 'smoke', 'restore_smoke']);
    docker(['exec', '-T', 'db', 'pg_restore', '-U', 'smoke', '-d', 'restore_smoke', '--exit-on-error', '--no-owner', '--no-privileges'], { input: fs.readFileSync(dump) });
    const sql = 'SELECT (SELECT count(*) FROM pedidos), (SELECT sum(quantidade_disponivel) FROM produtos), (SELECT sum(valor) FROM financeiro_entradas), (SELECT count(*) FROM schema_migrations)';
    const original = docker(['exec', '-T', 'db', 'psql', '-U', 'smoke', '-d', 'smoke', '-Atc', sql]);
    const restored = docker(['exec', '-T', 'db', 'psql', '-U', 'smoke', '-d', 'restore_smoke', '-Atc', sql]);
    assert.equal(restored, original);
    console.log('HTTPS, páginas, login, pedido, estoque, financeiro, reinício e recuperação de backup aprovados.');
  } finally {
    agent?.destroy();
    docker(['down', '--volumes', '--remove-orphans'], { stdio: 'inherit' });
    const target = path.resolve(temp);
    if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('doceponto-smoke-')) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
