import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { databaseStartupError } from './db/startup-error.js';

const app = createApp({ jwtSecret: process.env.JWT_SECRET, frontendOrigin: process.env.FRONTEND_ORIGIN, trustProxy: process.env.TRUST_PROXY === 'loopback' ? 'loopback' : false });
try {
  await connectDatabase(process.env.MONGODB_URI);
} catch (error) {
  for (const message of databaseStartupError(error)) console.error(message);
  await disconnectDatabase();
  process.exit(1);
}
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(Number(process.env.PORT || 3000), host, () => console.log(`Secure Notes: http://${host}:${process.env.PORT || 3000}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await disconnectDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
