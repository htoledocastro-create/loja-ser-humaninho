// Cria o pagamento no Mercado Pago (Checkout Pro) e devolve o link para o cliente pagar.
const { autenticado } = require("./_auth.js");
const CATALOGO = require("./_catalogo.js");
const { MP_ACCESS_TOKEN, MAX_INSTALLMENTS = "6", VALIDAR_CATALOGO = "1", DESCONTO_MAX_PCT = "20" } = process.env;

const hits = new Map();
const livre = (k, max, ms) => {
  const n = Date.now(), h = (hits.get(k) || []).filter((t) => n - t < ms);
  if (h.length >= max) return false;
  h.push(n); hits.set(k, h); return true;
};
const resp = (res, s, o) => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.status(s).json(o); };
const money = (n) => Math.round(Number(n) * 100) / 100;
const baseName = (k) => String(k).replace(/ \((RN|P|M|G|GG)\)( ✎ .*)?$/, "");

function validar(b) {
  const { no, items, ship, total, cust, pay } = b || {};
  if (!/^LL-\d{6}$/.test(String(no || ""))) return "Pedido inválido.";
  if (!["pix", "cartao", "boleto"].includes(pay)) return "Forma de pagamento inválida.";
  if (!Array.isArray(items) || !items.length || items.length > 50) return "Carrinho inválido.";
  if (!cust || !/^\S+@\S+\.\S+$/.test(String(cust.e || ""))) return "E-mail inválido.";
  let soma = 0;
  for (const it of items) {
    const q = Number(it.q), p = Number(it.p), fee = Number(it.fee) || 0;
    if (!(q >= 1 && q <= 99) || !(p > 0) || fee < 0 || fee > 100) return "Item inválido.";
    if (VALIDAR_CATALOGO !== "0") {
      const base = CATALOGO[baseName(it.n)];
      if (base == null) return "Produto não encontrado no catálogo: " + baseName(it.n);
      if (money(p) < money(base) - 0.01 || money(p) > money(base + fee) + 0.01) return "Preço divergente: " + baseName(it.n);
    }
    soma += q * p;
  }
  const t = Number(total), s = Number(ship) || 0;
  // Descontos (Pix, cupom) só reduzem o total, até o limite DESCONTO_MAX_PCT; nunca acima do bruto.
  const lim = 1 - Math.min(90, Math.max(0, parseFloat(DESCONTO_MAX_PCT) || 20)) / 100;
  if (!(t > 0) || t > soma + s + 0.01 || t < (soma + s) * lim - 0.01) return "Total inconsistente.";
  return "";
}

const tipos = (id) => ({ id });
function metodos(pay) {
  const todos = ["credit_card", "debit_card", "bank_transfer", "ticket", "atm", "prepaid_card"];
  const permitido = { pix: ["bank_transfer"], boleto: ["ticket"], cartao: ["credit_card", "debit_card"] }[pay];
  const m = { excluded_payment_types: todos.filter((x) => !permitido.includes(x)).map(tipos) };
  if (pay === "cartao") m.installments = Math.max(1, Math.min(12, parseInt(MAX_INSTALLMENTS) || 6));
  return m;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return resp(res, 405, { erro: "Método não permitido." });
  if (!autenticado(req)) return resp(res, 401, { erro: "Sessão expirada." });
  if (!MP_ACCESS_TOKEN) return resp(res, 500, { erro: "O pagamento ainda não foi configurado no servidor." });
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "x";
  if (!livre("ip:" + ip, 10, 60000)) return resp(res, 429, { erro: "Muitas tentativas. Aguarde um instante." });
  const erro = validar(req.body);
  if (erro) return resp(res, 400, { erro });

  const { no, total, cust, pay } = req.body;
  const origem = `https://${req.headers.host}`;
  try {
    const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: "Bearer " + MP_ACCESS_TOKEN, "Content-Type": "application/json", "X-Idempotency-Key": no },
      body: JSON.stringify({
        items: [{ id: no, title: `Pedido ${no} - Ser Humaninho`, quantity: 1, unit_price: money(total), currency_id: "BRL" }],
        external_reference: no,
        payer: { email: String(cust.e), name: String(cust.n || "").slice(0, 60) },
        payment_methods: metodos(pay),
        back_urls: {
          success: `${origem}/?pagamento=aprovado&pedido=${no}`,
          pending: `${origem}/?pagamento=pendente&pedido=${no}`,
          failure: `${origem}/?pagamento=recusado&pedido=${no}`,
        },
        auto_return: "approved",
        statement_descriptor: "SERHUMANINHO",
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.init_point) {
      console.error("Mercado Pago", r.status, JSON.stringify(j).slice(0, 400));
      return resp(res, 502, { erro: "Não foi possível iniciar o pagamento agora. Tente de novo em instantes." });
    }
    return resp(res, 200, { init_point: j.init_point, id: j.id });
  } catch (e) {
    console.error("Erro Mercado Pago:", e && e.message);
    return resp(res, 502, { erro: "Não foi possível iniciar o pagamento agora. Tente de novo em instantes." });
  }
};
