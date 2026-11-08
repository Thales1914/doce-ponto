// Validação compartilhada pelo boot da API e pelo comando de preparação do deploy.
function validateProductionEnv(values) {
  const errors = [];
  const secret = (name, minimum) => {
    const value = values[name] || '';
    if (value.length < minimum || /troque|change.?me|example|exemplo|admin123|password|senha-de-teste/i.test(value)) {
      errors.push(`${name}: use um valor exclusivo com pelo menos ${minimum} caracteres.`);
    }
  };
  secret('JWT_SECRET', 32);
  if (!values.DATABASE_URL) secret('POSTGRES_PASSWORD', 16);
  if (values.ADMIN_SENHA) {
    secret('ADMIN_SENHA', 12);
    if (Buffer.byteLength(values.ADMIN_SENHA, 'utf8') > 72) errors.push('ADMIN_SENHA: máximo de 72 bytes.');
  }
  try {
    const url = new URL(values.PUBLIC_ORIGIN);
    if (url.protocol !== 'https:' || url.origin !== values.PUBLIC_ORIGIN || url.username || url.password) throw new Error();
  } catch {
    errors.push('PUBLIC_ORIGIN/CORS_ORIGIN: informe uma única origem HTTPS, sem caminho ou barra final.');
  }
  if (values.JWT_EXPIRES_IN && !/^[1-9]\d*(s|m|h|d)$/.test(values.JWT_EXPIRES_IN)) {
    errors.push('JWT_EXPIRES_IN: use uma duração como 30m ou 8h.');
  }
  if (errors.length) throw new Error(`Configuração de produção inválida:\n${errors.join('\n')}`);
}
module.exports = { validateProductionEnv };
