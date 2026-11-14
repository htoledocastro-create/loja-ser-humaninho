// Portão de acesso: o site só abre com o link que contém o código (?c=...) e a senha.
// Segredos ficam em variáveis de ambiente da Vercel (SITE_PASSWORD e ACCESS_CODE), nunca no código.
const crypto = require("crypto");
const { sessao, igual, cookies } = require("./_auth.js");

const { SITE_PASSWORD, ACCESS_CODE } = process.env;
const PAGE = require("./_page.js");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Limite de tentativas por IP (melhor esforço; reinicia quando o servidor reinicia).
const falhas = new Map();
const JANELA = 15 * 60 * 1000, MAX = 5;
const ip = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
const bloqueado = (i) => (falhas.get(i) || []).filter((t) => Date.now() - t < JANELA).length >= MAX;
const falhou = (i) => falhas.set(i, [...(falhas.get(i) || []).filter((t) => Date.now() - t < JANELA), Date.now()]);

const base = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const naoEncontrado = (res) => {
  res.writeHead(404, { ...base, "Content-Type": "text/html; charset=utf-8" });
  res.end("<!doctype html><meta charset=utf-8><title>404</title><p style='font:16px system-ui;padding:40px'>Página não encontrada.</p>");
};

const login = (res, codigo, erro, status = 200) => {
  res.writeHead(status, { ...base, "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Acesso restrito</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f1f5fa;color:#2f4a78;font:16px/1.5 system-ui,sans-serif}
form{background:#fff;border-radius:20px;padding:28px;width:min(380px,calc(100% - 32px));box-shadow:0 8px 30px rgba(47,74,120,.12)}
h1{font-size:22px;margin:0 0 6px}p{margin:0 0 16px;color:#5f6f8c;font-size:14px}
input{width:100%;box-sizing:border-box;padding:13px 14px;border:2px solid #9fb2cf;border-radius:12px;font-size:16px}
button{margin-top:14px;width:100%;padding:13px;border:0;border-radius:999px;background:#ecadca;color:#2f4a78;font-weight:700;font-size:16px;cursor:pointer}
.e{color:#c0392b;min-height:20px;margin-top:10px;font-size:14px}</style></head><body>
<form method="post" action="/"><h1>Acesso restrito</h1><p>Digite a senha para abrir o site.</p>
<input type="hidden" name="c" value="${esc(codigo)}"><input type="password" name="s" autocomplete="current-password" placeholder="Senha" required autofocus>
<div class="e" role="alert">${esc(erro || "")}</div><button type="submit">Entrar</button></form></body></html>`);
};

module.exports = (req, res) => {
  if (!SITE_PASSWORD || !ACCESS_CODE) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Configure SITE_PASSWORD e ACCESS_CODE nas variáveis de ambiente da Vercel.");
  }
  const url = new URL(req.url, "https://x");
  const c = cookies(req);

  // Já autenticado: entrega o site.
  if (c.acesso && igual(c.acesso, sessao())) {
    res.writeHead(200, { ...base, "Content-Type": "text/html; charset=utf-8" });
    return res.end(PAGE);
  }

  const codigo = req.method === "POST" ? String((req.body && req.body.c) || "") : url.searchParams.get("c") || "";
  // Sem o link com o código correto, o site "não existe".
  if (!igual(codigo, ACCESS_CODE)) return naoEncontrado(res);

  if (req.method === "POST") {
    const i = ip(req);
    if (bloqueado(i)) return login(res, codigo, "Muitas tentativas. Tente de novo em 15 minutos.", 429);
    if (igual((req.body && req.body.s) || "", SITE_PASSWORD)) {
      res.writeHead(303, {
        ...base,
        Location: "/",
        "Set-Cookie": `acesso=${sessao()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
      });
      return res.end();
    }
    falhou(i);
    return login(res, codigo, "Senha incorreta.", 401);
  }
  return login(res, codigo, "");
};
