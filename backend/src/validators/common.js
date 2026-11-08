const { z } = require('zod');

// Mensagens de validação em português
z.config(z.locales.pt());

const id = z.coerce.number().int().positive().max(2147483647);
const idParam = z.object({ id });

/** Valor monetário positivo com no máximo 2 casas decimais. */
const money = (opts = {}) => {
  let s = z.number().max(9_999_999.99);
  s = opts.allowZero ? s.min(0) : s.positive();
  return s.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Use no máximo 2 casas decimais.');
};

/** Data no formato YYYY-MM-DD. */
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return v.slice(0, 4) !== '0000' && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Data inválida.');

const pagination = {
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();

const periodoValido = (value) => !value.inicio || !value.fim || value.inicio <= value.fim;
const erroPeriodo = { message: 'A data inicial deve ser anterior ou igual à final.', path: ['inicio'] };
const contato = z.string().trim().min(5).max(120).refine((value) =>
  z.email().safeParse(value).success || (/^\+?[\d\s().-]+$/.test(value) &&
    value.replace(/\D/g, '').length >= 8 && value.replace(/\D/g, '').length <= 15),
'Informe um telefone ou e-mail válido.');

module.exports = { z, id, idParam, money, dateStr, pagination, boolQuery, optionalText, periodoValido, erroPeriodo, contato };
