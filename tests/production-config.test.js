const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateProductionEnv } = require('../src/config/production');
const valid = {
  JWT_SECRET: 'd4cb601e2fd748514c4b0f0ef8b892e75ef20fc8f3227a1c',
  POSTGRES_PASSWORD: '82ac13f5b0d049f2ba71e8017314caae',
  ADMIN_SENHA: 'UcVw7gbdSx0AeF4k', PUBLIC_ORIGIN: 'https://doces.example.org', JWT_EXPIRES_IN: '8h',
};
test('produção aceita configuração HTTPS e segredos exclusivos', () => {
  assert.doesNotThrow(() => validateProductionEnv(valid));
});
test('produção recusa credenciais de exemplo, CORS aberto e prazo inválido sem expor segredos', () => {
  for (const [key, value] of [
    ['JWT_SECRET', 'troque-por-um-segredo-longo-e-aleatorio'],
    ['POSTGRES_PASSWORD', 'doces'], ['ADMIN_SENHA', 'admin12345'],
    ['ADMIN_SENHA', 'á'.repeat(37)], ['PUBLIC_ORIGIN', '*'],
    ['PUBLIC_ORIGIN', 'http://doces.example.org'], ['PUBLIC_ORIGIN', 'https://doces.example.org/app'],
    ['PUBLIC_ORIGIN', 'https://user:pass@doces.example.org'], ['JWT_EXPIRES_IN', 'abc'],
  ]) {
    assert.throws(() => validateProductionEnv({ ...valid, [key]: value }), /Configuração de produção inválida/);
  }
});
test('produção permite reutilizar conta já criada sem senha de bootstrap', () => {
  assert.doesNotThrow(() => validateProductionEnv({ ...valid, ADMIN_SENHA: undefined }));
});
