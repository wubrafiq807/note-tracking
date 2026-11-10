import { it } from 'node:test';
import assert from 'node:assert/strict';
import { databaseStartupError } from '../src/db/startup-error.js';

it('recognizes TLS failures nested inside server selection errors', () => {
  const error = { reason: { servers: new Map([['host', { error: { cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' } } }]]) } };
  assert.match(databaseStartupError(error)[0], /TLS handshake failed before authentication/);
});
it('distinguishes authentication and index errors', () => {
  assert.match(databaseStartupError({ code: 8000 })[0], /authentication failed/);
  assert.match(databaseStartupError({ code: 11000 })[0], /index initialization failed/);
});
it('never includes raw driver messages or connection credentials', () => {
  const result = databaseStartupError(new Error('mongodb+srv://private-user:private-password@example.com SSL routines failed'));
  assert.doesNotMatch(result.join(' '), /private-user|private-password|mongodb\+srv/);
});
