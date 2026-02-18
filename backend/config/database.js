/**
 * Prisma Client Configuration
 * Singleton pattern to prevent connection pool exhaustion during hot reloads
 */

const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;