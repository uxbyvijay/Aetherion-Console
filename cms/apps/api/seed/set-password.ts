/**
 * Sets (or creates) an admin sign-in from the terminal. Use it when you cannot sign in:
 *   npm run set-password -w apps/api -- you@example.com "a password of 8 or more characters" ["Your Name"]
 * The account becomes an admin if it is new. An existing account keeps its role and gets the new password.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { sealPassword } from '../src/pwvault.js';

const [emailArg, password, nameArg] = process.argv.slice(2);
if (!emailArg || !password || password.length < 8) {
  console.error('Usage: npm run set-password -w apps/api -- <email> "<password, 8 or more characters>" ["Name"]');
  process.exit(1);
}

const prisma = new PrismaClient();
const email = emailArg.trim().toLowerCase();
const passwordHash = await bcrypt.hash(password, 10);
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, mustChangePassword: false, passwordCopy: sealPassword(password) } });
  console.log(`Password changed for ${email}.`);
} else {
  await prisma.user.create({ data: { email, name: nameArg?.trim() || email.split('@')[0], passwordHash, passwordCopy: sealPassword(password), isSuperAdmin: true } });
  console.log(`Created the admin ${email}.`);
}
await prisma.$disconnect();
