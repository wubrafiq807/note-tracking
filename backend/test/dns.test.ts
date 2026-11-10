import { afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import { configureDatabaseDns } from '../src/db/connection.js';

// setServers replaces the default resolver; read the live methods rather than
// keeping a named getServers binding to the previous resolver instance.
const getServers = () => dns.promises.getServers();
const setServers = (servers: string[]) => dns.promises.setServers(servers);
const originalServers = getServers();
afterEach(() => setServers(originalServers));

it('keeps system DNS unless an override is configured', () => {
  configureDatabaseDns(undefined);
  configureDatabaseDns('  ');
  assert.deepEqual(getServers(), originalServers);
});
it('sets explicitly configured IPv4 and IPv6 DNS resolvers', () => {
  configureDatabaseDns('1.1.1.1, 8.8.8.8');
  assert.deepEqual(getServers(), ['1.1.1.1', '8.8.8.8']);
  configureDatabaseDns('2606:4700:4700::1111');
  assert.deepEqual(getServers(), ['2606:4700:4700::1111']);
});
it('rejects invalid DNS configuration without changing resolvers', () => {
  for (const value of ['invalid', '1.1.1.1,', 'https://1.1.1.1']) {
    assert.throws(() => configureDatabaseDns(value), /comma-separated DNS server IP addresses/);
  }
  assert.deepEqual(getServers(), originalServers);
});
