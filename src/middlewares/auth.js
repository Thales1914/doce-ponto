const { verifyToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const { pool } = require('../db/pool');
const adminModel = require('../models/adminModel');

/** Exige JWT válido da administradora. */
async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer ([^\s]+)$/i.exec(header);
  if (!match) return next(AppError.unauthorized('Token de acesso ausente ou malformado.'));
  try {
    req.admin = verifyToken(match[1]);
  } catch {
    return next(AppError.unauthorized('Token inválido ou expirado.'));
  }
  const admin = await adminModel.findById(pool, req.admin.id);
  if (!admin) return next(AppError.unauthorized('Administradora não encontrada.'));
  req.admin = admin;
  next();
}

function optionalAdmin(req, res, next) {
  if (req.headers.authorization !== undefined) return requireAdmin(req, res, next);
  next();
}

module.exports = { requireAdmin, optionalAdmin };
