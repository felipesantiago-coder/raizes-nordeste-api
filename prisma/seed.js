// Seed de dados iniciais: unidades, produtos com estoque por unidade e usuários
// de teste (um de cada perfil). As senhas de todos os usuários de teste são
// "Senha@123" — apenas para ambiente de desenvolvimento.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('Senha@123', 10);

  // --- Unidades ---
  const matriz = await prisma.unidade.create({
    data: { nome: 'Recife — Boa Viagem (matriz)', cidade: 'Recife', ativa: true }
  });
  const centro = await prisma.unidade.create({
    data: { nome: 'Recife — Centro', cidade: 'Recife', ativa: true }
  });
  const caruaru = await prisma.unidade.create({
    data: { nome: 'Caruaru — Centro', cidade: 'Caruaru', ativa: true }
  });

  // --- Produtos ---
  const produtos = await Promise.all([
    prisma.produto.create({ data: { nome: 'Tapioca de carne seca', descricao: 'Tapioca recheada com carne seca e queijo coalho', precoUnitario: 18.9, categoria: 'Tapiocas' } }),
    prisma.produto.create({ data: { nome: 'Cuscuz recheado', descricao: 'Cuscuz de milho recheado com queijo e ovo', precoUnitario: 16.5, categoria: 'Cuscuz' } }),
    prisma.produto.create({ data: { nome: 'Bolo de macaxeira', descricao: 'Fatia de bolo de macaxeira com coco', precoUnitario: 9.9, categoria: 'Doces' } }),
    prisma.produto.create({ data: { nome: 'Suco de cajá', descricao: 'Suco natural 500ml', precoUnitario: 8.5, categoria: 'Bebidas' } }),
    prisma.produto.create({ data: { nome: 'Café passado', descricao: 'Café na hora 300ml', precoUnitario: 4.5, categoria: 'Bebidas' } }),
    prisma.produto.create({ data: { nome: 'Pão na chapa com manteiga de garrafa', precoUnitario: 7.9, categoria: 'Lanches' } }),
    prisma.produto.create({ data: { nome: 'Queijo coalho na brasa', descricao: 'Espetinho de queijo coalho', precoUnitario: 12.9, categoria: 'Lanches' } }),
    prisma.produto.create({ data: { nome: 'Vitamina de manga', descricao: 'Vitamina com leite 400ml', precoUnitario: 9.5, categoria: 'Bebidas' } }),
    prisma.produto.create({ data: { nome: 'Beiju de coco', precoUnitario: 6.9, categoria: 'Tapiocas' } }),
    prisma.produto.create({ data: { nome: 'Caldo de carne com macaxeira', precoUnitario: 14.0, categoria: 'Caldos' } })
  ]);

  // --- Estoque por unidade ---
  // Matriz: estoque completo. Centro: estoque médio. Caruaru: reduzido e com
  // um produto zerado (para exercitar a restrição de venda por indisponibilidade).
  const estoques = [];
  const adicionar = (unidadeId, fator, zerarNome) => {
    produtos.forEach((p) => {
      const zerado = p.nome === zerarNome;
      estoques.push({
        unidadeId,
        produtoId: p.id,
        quantidade: zerado ? 0 : Math.round(50 * fator),
        minimo: 5
      });
    });
  };
  adicionar(matriz.id, 1, null);
  adicionar(centro.id, 0.6, null);
  adicionar(caruaru.id, 0.4, 'Caldo de carne com macaxeira');
  await prisma.estoque.createMany({ data: estoques });

  // --- Usuários (senha de teste: Senha@123) ---
  const gerente = await prisma.usuario.create({
    data: { nome: 'Gerente da Matriz', email: 'gerente@raizes.com', senhaHash, perfil: 'GERENTE' }
  });
  await prisma.usuario.create({ data: { nome: 'Cozinha Boa Viagem', email: 'cozinha@raizes.com', senhaHash, perfil: 'COZINHA' } });
  await prisma.usuario.create({ data: { nome: 'Atendente Balcão', email: 'atendente@raizes.com', senhaHash, perfil: 'ATENDENTE' } });

  // Cliente com consentimento LGPD (participa da fidelidade)
  const cliente = await prisma.usuario.create({
    data: {
      nome: 'Maria da Silva',
      email: 'cliente@raizes.com',
      senhaHash,
      perfil: 'CLIENTE',
      dataConsentimento: new Date(),
      versaoTermo: '1.0'
    }
  });

  // Cliente sem consentimento (não participa da fidelidade)
  await prisma.usuario.create({
    data: { nome: 'João sem Consentimento', email: 'cliente2@raizes.com', senhaHash, perfil: 'CLIENTE' }
  });

  // Contas de fidelidade zeradas para quem consentiu
  await prisma.contaFidelidade.create({ data: { clienteId: cliente.id, saldoPontos: 0 } });

  console.log('Seed concluído:');
  console.log(`  Unidades: ${matriz.id}, ${centro.id}, ${caruaru.id}`);
  console.log(`  Produtos: ${produtos.length}`);
  console.log(`  Gerente: gerente@raizes.com (id ${gerente.id})`);
  console.log(`  Cliente com fidelidade: cliente@raizes.com (id ${cliente.id})`);
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
