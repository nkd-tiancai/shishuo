import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: npm run admin:promote -- user@example.com");
  process.exitCode = 1;
} else {
  const user = await db.user.update({
    where: { email },
    data: { role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });
  console.log(`${user.email} is now ${user.role}`);
}

await db.$disconnect();
