// Informa à loja se o servidor de pagamentos existe (para ligar o checkout do Mercado Pago).
module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ ok: true, configurado: !!process.env.MP_ACCESS_TOKEN });
};
