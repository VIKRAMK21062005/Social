const prisma = require('./config/database');

async function test() {
  try {
    const user = await prisma.user.create({
      data: {
        name: "Mongo Test",
        email: "mongo@test.com",
        password: "123"
      }
    });

    console.log("Inserted:", user);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
