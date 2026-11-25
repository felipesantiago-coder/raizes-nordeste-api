// Cliente Prisma único — camada de infraestrutura.
// Carrega o .env na entrada da aplicação (ver src/app.js).
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Valor padrão quando não há .env (o build da Vercel usa o mesmo caminho)
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';

// Na Vercel o sistema de arquivos é somente leitura (exceto /tmp): o banco
// criado no build (migrate + seed) é copiado para /tmp no primeiro uso da
// função. A cada novo container os dados voltam ao estado do seed —
// comportamento aceitável para uma demonstração.
if (process.env.VERCEL) {
  const origem = path.join(__dirname, '..', '..', 'prisma', 'dev.db');
  const destino = '/tmp/raizes-nordeste.db';
  try {
    if (!fs.existsSync(destino) && fs.existsSync(origem)) {
      fs.copyFileSync(origem, destino);
    }
    process.env.DATABASE_URL = `file:${destino}`;
  } catch (_) {
    // sem permissão de cópia: segue com o caminho padrão
  }
}

const prisma = new PrismaClient();

module.exports = prisma;
