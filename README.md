# Site Ser Humaninho na Vercel, com acesso por link + senha

O site só abre para quem tem o **link com o código** (`https://SEU-SITE.vercel.app/?c=CÓDIGO`) e a **senha**. Sem o código correto, qualquer endereço mostra "Página não encontrada".

## Subir
1. Crie uma conta em vercel.com e um repositório no GitHub com o conteúdo desta pasta, **mantendo as pastas** (o arquivo `api/site.js` precisa estar dentro da pasta `api`, na raiz do repositório). Arraste a pasta inteira para o GitHub, não os arquivos soltos. Ou use `npx vercel` dentro da pasta.
2. Na Vercel: **Add New > Project**, escolha o repositório. Framework: **Other**. Não precisa de comando de build.
3. Em **Settings > Environment Variables**, crie (marque Production):
   - `SITE_PASSWORD` = a senha que você escolheu
   - `ACCESS_CODE` = o código de acesso (letras e números, sem espaço)
4. **Deploy**. Depois, abra `https://SEU-SITE.vercel.app/?c=SEU_CÓDIGO`, digite a senha e pronto. O acesso fica salvo por 8 horas naquele aparelho.

## Segurança
- A senha e o código **não ficam nos arquivos**, só nas variáveis da Vercel.
- 5 senhas erradas bloqueiam o IP por 15 minutos. Há bloqueio de indexação em buscadores.
- Para trocar senha ou código: altere as variáveis e faça **Redeploy**. Os acessos antigos deixam de valer.
- Compartilhe o link com código só com quem pode entrar. Quem tiver o link e a senha entra.

## Importante: limites desta versão
O site foi feito para rodar dentro do Claude, que fornece o banco de dados e o envio de fotos. Fora dele (Vercel), a vitrine abre, mas **o que depende desse banco não grava**: catálogo editado, pedidos, usuários, gestor, layout, pop-up, cofre e envio de fotos. Para operar a loja de verdade fora do Claude é preciso trocar esse banco por um servidor próprio (o kit do Mercado Pago em `mercado-pago-backend` já prepara parte disso).

## Envio real do link por e-mail (Entrar com link mágico)
O site envia o link pelo **Resend** (resend.com). Sem isso, o botão volta ao modo demonstração.
1. Crie uma conta gratuita no Resend e gere uma **API Key** (API Keys, Create).
2. **Teste rápido:** use `MAIL_FROM` = `Ser Humaninho <onboarding@resend.dev>`. Nesse modo o Resend só entrega para o e-mail da sua própria conta.
3. **Uso real:** em Domains, adicione e verifique o seu domínio (ex.: serhumaninho.com.br), e use `MAIL_FROM` = `Ser Humaninho <acesso@seudominio.com.br>`.
4. Na Vercel (Settings, Environment Variables) crie:
   - `RESEND_API_KEY` = a chave do Resend
   - `MAIL_FROM` = o remetente acima
   - `LINK_SECRET` (opcional, recomendado) = um texto longo e aleatório, só para assinar os links
5. Faça **Redeploy**.

Como funciona: o e-mail traz um link que vale 15 minutos. Ao abrir, o site confere a assinatura e faz o login. Para gestores com Google Authenticator, o código continua sendo pedido. Os links são assinados no servidor, então ninguém consegue entrar só digitando um e-mail.

Limites: (1) enquanto o portão de senha do site estiver ligado, o link precisa ser aberto no **mesmo navegador** em que a senha do site foi digitada; (2) a regra "só pode ser usado uma vez" vale enquanto o servidor da Vercel estiver ativo, e o prazo de 15 minutos vale sempre.

## Pagamento pelo Mercado Pago (Checkout Pro)
Na finalização do pedido, o cliente escolhe Pix, cartão ou boleto e é levado ao ambiente seguro do Mercado Pago para pagar. O site **não** recebe nem guarda dados de cartão.

Variáveis de ambiente na Vercel:
- `MP_ACCESS_TOKEN` (obrigatória): Access Token do Mercado Pago. Painel de desenvolvedores, Suas integrações, criar aplicação (Checkout Pro), Credenciais. Use primeiro o **de teste** (começa com `TEST-`) e, quando tudo funcionar, troque pelo **de produção** (começa com `APP_USR-`).
- `MAX_INSTALLMENTS` (opcional): máximo de parcelas no cartão. Padrão 6.
- `DESCONTO_MAX_PCT` (opcional): maior desconto aceito sobre o total (Pix, cupom). Padrão 20.
- `VALIDAR_CATALOGO` (opcional): `0` desliga a conferência de preços pelo `api/_catalogo.js`.

Como funciona:
- Os preços de cada produto são conferidos no servidor com `api/_catalogo.js`. **Se você mudar preços ou produtos no site, atualize esse arquivo**, senão o pagamento recusa o produto.
- Pix só mostra Pix, boleto só mostra boleto, e cartão mostra crédito e débito com até `MAX_INSTALLMENTS` parcelas.
- Ao voltar do pagamento, o cliente vê uma mensagem de aprovado, pendente ou não concluído.
- A situação real do pagamento fica no painel do Mercado Pago. Como a Vercel não guarda dados, o site não atualiza sozinho o painel de pedidos da loja.
- Para testar: crie usuários de teste no Mercado Pago e use os cartões de teste da documentação deles. Só ative o token de produção depois.

Observação: a pasta `mercado-pago-backend`, que veio antes, era para hospedar um servidor próprio. **Não é necessária** com este projeto na Vercel.
