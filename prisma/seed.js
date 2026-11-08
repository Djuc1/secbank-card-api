import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

const customers = [
  {
    accountNumber: '0123456789',
    firstName: 'John',
    lastName: 'Okafor',
    email: 'john.okafor@example.test',
    phoneNumber: '08030000001',
    accountStatus: 'ACTIVE',
  },
  {
    accountNumber: '0123456790',
    firstName: 'Mary',
    lastName: 'James',
    email: 'mary.james@example.test',
    phoneNumber: '08030000002',
    accountStatus: 'ACTIVE',
  },
  {
    accountNumber: '0123456791',
    firstName: 'David',
    lastName: 'Bello',
    email: 'david.bello@example.test',
    phoneNumber: '08030000003',
    accountStatus: 'BLOCKED',
  },
  {
    accountNumber: '0123456792',
    firstName: 'Sarah',
    lastName: 'Ade',
    email: 'sarah.ade@example.test',
    phoneNumber: '08030000004',
    accountStatus: 'DORMANT',
  },
];

async function main() {
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { accountNumber: customer.accountNumber },
      update: customer,
      create: customer,
    });
  }

  console.log(`Successfully seeded ${customers.length} customers.`);
}

main()
  .catch((error) => {
    console.error('Database seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
