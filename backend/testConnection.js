
const prisma = require('./config/database');

async function testDB() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    const usersCount = await prisma.user.count();
    console.log(`👥 Users in DB: ${usersCount}`);

  } catch (error) {
    console.error('❌ DB Connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDB();
