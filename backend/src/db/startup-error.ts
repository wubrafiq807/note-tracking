type ErrorRecord = Record<string, unknown>;
function record(value: unknown): ErrorRecord | undefined {
  return value !== null && typeof value === 'object' ? value as ErrorRecord : undefined;
}

// Report actionable categories without logging connection strings or credentials.
export function databaseStartupError(error: unknown): string[] {
  const pending: unknown[] = [error];
  const seen = new Set<unknown>();
  const errors: ErrorRecord[] = [];
  while (pending.length) {
    const value = pending.pop();
    if (seen.has(value)) continue;
    seen.add(value);
    const current = record(value);
    if (!current) continue;
    errors.push(current);
    pending.push(current.cause, current.reason);
    if (current.servers instanceof Map) {
      for (const server of current.servers.values()) pending.push(record(server)?.error);
    }
  }
  if (errors.some(item => item.code === 18 || item.code === 8000)) {
    return ['MongoDB authentication failed.', 'Check the database username/password and authentication database used by the working Compass connection.'];
  }
  if (errors.some(item => String(item.code).startsWith('ERR_SSL') || /SSL routines|TLS handshake/i.test(String(item.message)))) {
    return ['MongoDB TLS handshake failed before authentication.', 'Compare the working Compass connection\'s TLS, proxy/SSH, and hostname settings. Certificate validation remains enabled.'];
  }
  if (errors.some(item => String(item.syscall).startsWith('query'))) {
    return ['MongoDB DNS lookup failed.', 'Check MONGODB_DNS_SERVERS in backend/.env or use the standard non-SRV connection string supplied by Atlas.'];
  }
  if (errors.some(item => item.code === 13)) {
    return ['MongoDB authorization failed.', 'The database user needs permissions to read/write secure_notes and create its collections and indexes.'];
  }
  if (errors.some(item => [85, 86, 11000].includes(Number(item.code)))) {
    return ['MongoDB index initialization failed.', 'Check existing index definitions and duplicate email values; no indexes or records were automatically removed.'];
  }
  return ['MongoDB startup failed.', 'Check MONGODB_URI, database availability, credentials, and the Atlas IP access list.'];
}
