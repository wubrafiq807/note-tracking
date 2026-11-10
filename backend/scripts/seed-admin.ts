import bcrypt from 'bcryptjs';
import * as users from '../src/repositories/user.repository.js';
import * as auth from '../src/repositories/auth.repository.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { accountInput } from '../src/validation.js';
import { databaseStartupError } from '../src/db/startup-error.js';
import { ZodError } from 'zod';

let databaseConnected = false;
try {
  const { password, ...data } = accountInput.parse({ name: process.env.ADMIN_NAME || 'Administrator', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await connectDatabase(process.env.MONGODB_URI);
  databaseConnected = true;
  const existing = await auth.findLogin(data.email);
  if (existing) {
    if (existing.role === 'admin' && await bcrypt.compare(password, existing.passwordHash)) {
      console.log('Administrator already exists and matches the configured credentials');
    } else {
      throw new Error('Email already exists with different credentials or role; seed will not overwrite an account');
    }
  } else {
    await users.create({ ...data, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
    console.log('Administrator created');
  }
} catch (error) {
  if (error instanceof ZodError) {
    for (const issue of error.issues) console.error(`Admin configuration: ${issue.path.join('.')}: ${issue.message}`);
  } else if (databaseConnected && error instanceof Error && error.message.startsWith('Email already exists')) {
    console.error(error.message);
  } else {
    for (const message of databaseStartupError(error)) console.error(message);
    console.error('If Compass is connected, run npm run seed:admin:query to generate a hashed bootstrap query for its existing connection.');
  }
  process.exitCode = 1;
} finally { await disconnectDatabase(); }
