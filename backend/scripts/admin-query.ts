import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { accountInput } from '../src/validation.js';

// Offline fallback: use Compass's already-working connection without creating
// another Node TLS session. No plaintext password is included in the output.
const parsed = accountInput.safeParse({ name: process.env.ADMIN_NAME || 'Administrator', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
if (!parsed.success) {
  for (const issue of parsed.error.issues) console.error(`${issue.path.join('.')}: ${issue.message}`);
  process.exitCode = 1;
} else {
  const { password, ...data } = parsed.data;
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const uri = new URL(process.env.MONGODB_URI);
  const database = decodeURIComponent(uri.pathname.slice(1)) || 'test';
  if (/[\/\\. "$\x00]/.test(database)) throw new Error('Invalid database name in MONGODB_URI');
  const user = { ...data, role: 'admin', passwordHash: await bcrypt.hash(password, 12), tokenVersion: 0 };
  const directory = fileURLToPath(new URL('../.cache/', import.meta.url));
  const output = fileURLToPath(new URL('../.cache/admin-bootstrap.mongodb.js', import.meta.url));
  const query = `// Run this in MongoDB Compass's connected MongoDB shell.\n// Generated from backend/.env. Contains a bcrypt hash, never the plaintext password.\n{\n  const target = db.getSiblingDB(${JSON.stringify(database)});\n  const account = ${JSON.stringify(user, null, 2)};\n  if (target.users.findOne({ email: account.email })) {\n    throw new Error('Email already exists. No account or password was changed.');\n  }\n  target.users.insertOne({ ...account, createdAt: new Date(), updatedAt: new Date() });\n  print('Administrator created. Sign in using the ADMIN_EMAIL and ADMIN_PASSWORD from backend/.env.');\n}\n`;
  await mkdir(directory, { recursive: true });
  await writeFile(output, query, { encoding: 'utf8', mode: 0o600 });
  console.log(`Generated: ${output}`);
  console.log('Open this file, copy its full contents, and run them in the connected Compass MongoDB shell. Existing accounts are never overwritten.');
}
