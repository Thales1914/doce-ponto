// Servidor manual de QA: cria seu próprio banco e remove somente esse banco ao encerrar.
const { setup } = require('./helpers');
async function main() {
  const ctx = await setup();
  const app = require('../src/app');
  let server;
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    if (server) await new Promise(resolve => server.close(resolve));
    await ctx.teardown();
  }
  try {
    for (const product of [
      {nome:'Brigadeiro tradicional',descricao:'Chocolate e granulado para os melhores momentos.',preco:3.5,quantidade_disponivel:40},
      {nome:'Beijinho de coco',descricao:'Coco e carinho em cada unidade.',preco:3,quantidade_disponivel:30},
      {nome:'Doce de leite',descricao:'Uma escolha delicada para sua encomenda.',preco:4.5,quantidade_disponivel:20},
    ]) {
      const result = await ctx.api('POST','/produtos',{token:ctx.token,body:product});
      if (result.status !== 201) throw new Error('Falha ao preparar produtos de teste.');
    }
    server = app.listen(3100,'0.0.0.0',() => console.log('Backend isolado de QA disponível na porta 3100.'));
    server.on('error',async error => { console.error(error.message); await close(); process.exitCode=1; });
    for (const signal of ['SIGINT','SIGTERM']) process.once(signal,() => close().catch(error => { console.error(error.message); process.exitCode=1; }));
  } catch(error) { await close(); throw error; }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
