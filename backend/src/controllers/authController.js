const authService = require('../services/authService');

exports.login = async (req, res) => {
  res.json(await authService.login(req.valid.body));
};

// requireAdmin já carregou a administradora do banco; evita repetir a consulta.
exports.me = (req, res) => {
  res.json(req.admin);
};
