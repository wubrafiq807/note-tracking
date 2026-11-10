import mongoose from 'mongoose';
import { setServers } from 'node:dns/promises';
import { isIP } from 'node:net';
import { initializeIndexes } from '../models.js';

export function configureDatabaseDns(value: string | undefined) {
  if (!value?.trim()) return;
  const servers = value.split(',').map(server => server.trim());
  if (servers.some(server => !isIP(server))) throw new Error('MONGODB_DNS_SERVERS must be comma-separated DNS server IP addresses');
  // The MongoDB driver uses Node's promise-based DNS resolver for SRV/TXT records.
  // Override only when explicitly configured; preserve system DNS by default.
  setServers(servers);
}

export async function connectDatabase(uri: string | undefined, dnsServers = process.env.MONGODB_DNS_SERVERS) {
  if (!uri) throw new Error('MONGODB_URI is required');
  if (uri.startsWith('mongodb+srv://')) configureDatabaseDns(dnsServers);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await initializeIndexes();
}
export async function disconnectDatabase() { await mongoose.disconnect(); }
