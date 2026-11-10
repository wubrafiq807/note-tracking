import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { databaseStartupError } from './db/startup-error.js';

const app = createApp({ jwtSecret: process.env.JWT_SECRET, frontendOrigin: process.env.FRONTEND_ORIGIN });
try {
  await connectDatabase(process.env.MONGODB_URI);
} catch (error) {
  for (const message of databaseStartupError(error)) console.error(message);
  await disconnectDatabase();
  process.exit(1);
}
const server = app.listen(Number(process.env.PORT || 3000), () => console.log(`Secure Notes: http://localhost:${process.env.PORT || 3000}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  server.close(async () => { await disconnectDatabase(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});
