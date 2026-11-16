// Funções compartilhadas: sessão do portão de acesso e assinatura dos links de e-mail.
const crypto = require("crypto");
const { SITE_PASSWORD, ACCESS_CODE, LINK_SECRET } = process.env;

const base = () => crypto.createHash("sha256").update(SITE_PASSWORD + "|" + ACCESS_CODE).digest();
const sessao = () => crypto.createHmac("sha256", base()).update("acesso-ok").digest("hex");
const igual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const cookies = (req) =>
  Object.fromEntries((req.headers.cookie || "").split(";").map((s) => s.trim().split("=")).filter((a) => a[0]));
const autenticado = (req) => {
  const c = cookies(req);
  return !!(SITE_PASSWORD && ACCESS_CODE && c.acesso && igual(c.acesso, sessao()));
};
// Chave de assinatura dos links: LINK_SECRET (recomendado) ou derivada da senha do site.
const chave = () => {
  if (LINK_SECRET) return crypto.createHash("sha256").update(LINK_SECRET).digest();
  if (SITE_PASSWORD && ACCESS_CODE) return base();
  throw new Error("sem chave");
};
module.exports = { sessao, igual, cookies, autenticado, chave };
