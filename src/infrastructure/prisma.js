// Cliente Prisma único — camada de infraestrutura.
// Carrega o .env na entrada da aplicação (ver src/app.js).
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
