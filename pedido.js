// Consulta a situação do pagamento de um pedido direto no Mercado Pago.
const { autenticado } = require("./_auth.js");
const { MP_ACCESS_TOKEN } = process.env;
const resp = (res, s, o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.status(s).json(o); };

module.exports = async (req, res) => {
  if (req.method !== "GET") return resp(res, 405, { erro: "Método não permitido." });
  if (!autenticado(req)) return resp(res, 401, { erro: "Sessão expirada." });
  if (!MP_ACCESS_TOKEN) return resp(res, 500, { erro: "Pagamento não configurado." });
  const no = String(req.query && req.query.no || "");
  if (!/^LL-\d{6}$/.test(no)) return resp(res, 400, { erro: "Pedido inválido." });
  try {
    const r = await fetch("https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=1&external_reference=" + encodeURIComponent(no), {
      headers: { Authorization: "Bearer " + MP_ACCESS_TOKEN },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return resp(res, 502, { erro: "Não foi possível consultar agora." });
    const p = (j.results || [])[0];
    if (!p) return resp(res, 200, { status: "nenhum" });
    const mapa = { approved: "aprovado", pending: "pendente", in_process: "pendente", authorized: "pendente", rejected: "recusado", cancelled: "recusado", refunded: "reembolsado", charged_back: "contestado" };
    return resp(res, 200, { status: mapa[p.status] || p.status });
  } catch (e) {
    return resp(res, 502, { erro: "Não foi possível consultar agora." });
  }
};
