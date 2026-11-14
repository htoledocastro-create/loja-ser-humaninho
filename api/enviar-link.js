// Envia o link de acesso por e-mail (Resend). O link vale 15 minutos.
const crypto = require("crypto");
const { autenticado, chave } = require("./_auth.js");
const { RESEND_API_KEY, MAIL_FROM } = process.env;

const hits = new Map();
const livre = (k, max, ms) => {
  const n = Date.now(), h = (hits.get(k) || []).filter((t) => n - t < ms);
  if (h.length >= max) return false;
  h.push(n); hits.set(k, h); return true;
};
const resp = (res, s, o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.status(s).json(o); };

module.exports = async (req, res) => {
  if (req.method !== "POST") return resp(res, 405, { erro: "Método não permitido." });
  if (!autenticado(req)) return resp(res, 401, { erro: "Sessão expirada." });
  if (!RESEND_API_KEY || !MAIL_FROM) return resp(res, 500, { erro: "O envio de e-mail ainda não foi configurado no servidor." });

  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 120) return resp(res, 400, { erro: "Digite um e-mail válido, como nome@exemplo.com." });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  if (!livre("ip:" + ip, 10, 600000) || !livre("em:" + email, 3, 600000))
    return resp(res, 429, { erro: "Muitos pedidos de link. Aguarde alguns minutos e tente de novo." });

  const payload = Buffer.from(JSON.stringify({ e: email, exp: Date.now() + 15 * 60 * 1000, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  const sig = crypto.createHmac("sha256", chave()).update(payload).digest("base64url");
  const link = `https://${req.headers.host}/?ml=${payload}.${sig}`;

  const html = `<div style="font:16px/1.6 system-ui,Arial,sans-serif;color:#2f4a78;max-width:480px;margin:0 auto;padding:24px">
<h2 style="font-weight:600;margin:0 0 12px">Seu acesso à Ser Humaninho</h2>
<p>Toque no botão para entrar. O link vale por <b>15 minutos</b> e só pode ser usado uma vez.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#ecadca;color:#2f4a78;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;display:inline-block">Entrar na loja</a></p>
<p style="font-size:13px;color:#5f6f8c">Se você não pediu este e-mail, pode ignorá-lo. Abra o link no mesmo aparelho e navegador em que você pediu o acesso.</p></div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [email], subject: "Seu link de acesso à Ser Humaninho", html, text: "Entre na Ser Humaninho (vale 15 minutos): " + link }),
    });
    if (!r.ok) { console.error("Resend", r.status, await r.text().catch(() => "")); return resp(res, 502, { erro: "Não foi possível enviar o e-mail agora. Tente de novo em instantes." }); }
    return resp(res, 200, { ok: true });
  } catch (e) {
    console.error("Erro ao enviar e-mail:", e && e.message);
    return resp(res, 502, { erro: "Não foi possível enviar o e-mail agora. Tente de novo em instantes." });
  }
};
