// Confere o link recebido por e-mail e devolve o e-mail da pessoa.
const crypto = require("crypto");
const { autenticado, chave, igual } = require("./_auth.js");

const usados = new Map(); // melhor esforço: vale enquanto o servidor estiver ativo
const resp = (res, s, o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.status(s).json(o); };

module.exports = (req, res) => {
  if (req.method !== "POST") return resp(res, 405, { erro: "Método não permitido." });
  if (!autenticado(req)) return resp(res, 401, { erro: "Sessão expirada. Recarregue a página e digite a senha do site." });
  const t = String((req.body && req.body.token) || "");
  const [p, s] = t.split(".");
  if (!p || !s || t.length > 600) return resp(res, 400, { erro: "Link inválido. Peça um novo link." });
  let esp;
  try { esp = crypto.createHmac("sha256", chave()).update(p).digest("base64url"); } catch (e) { return resp(res, 500, { erro: "Servidor não configurado." }); }
  if (!igual(s, esp)) return resp(res, 400, { erro: "Link inválido. Peça um novo link." });
  let o;
  try { o = JSON.parse(Buffer.from(p, "base64url").toString("utf8")); } catch (e) { return resp(res, 400, { erro: "Link inválido. Peça um novo link." }); }
  if (!o || !o.e || Date.now() > o.exp) return resp(res, 410, { erro: "Este link expirou. Peça um novo link." });
  for (const [k, v] of usados) if (Date.now() - v > 20 * 60 * 1000) usados.delete(k);
  if (usados.has(s)) return resp(res, 410, { erro: "Este link já foi usado. Peça um novo link." });
  usados.set(s, Date.now());
  return resp(res, 200, { email: o.e });
};
