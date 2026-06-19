import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function hashToken(value) {
  return crypto.createHash("sha256").update(value, "utf-8").digest("hex");
}

const label = process.argv[2] || "manual";
const code = crypto.randomBytes(18).toString("base64url");

await db.inviteCode.create({
  data: {
    label,
    codeHash: hashToken(code),
  },
});

console.log(code);
await db.$disconnect();
