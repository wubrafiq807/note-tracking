import bcrypt from 'bcryptjs';
import * as repository from '../repositories/user.repository.js';
import { fail, requireFound } from '../errors.js';
import { publicUser, pageResult } from '../validation.js';
import type { UserInput, UserUpdate } from '../validation.js';
import type { UserRecord } from '../models.js';
import type { Actor, Page } from '../types.js';
import type { UpdateQuery } from 'mongoose';

export async function list(page: Page) {
  const { data, total } = await repository.list(page);
  return pageResult(data.map(publicUser), total, page);
}
export async function create({ password, ...data }: UserInput) {
  return publicUser(await repository.create({ ...data, passwordHash: await bcrypt.hash(password, 12) }));
}
export async function find(id: string) { return publicUser(requireFound(await repository.find(id))); }
export async function update(actor: Actor, id: string, { password, ...rest }: UserUpdate) {
  const data: Partial<UserRecord> = rest;
  if (String(actor._id) === id && data.role === 'user') throw fail(400, 'Administrators cannot demote themselves');
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  const update: UpdateQuery<UserRecord> = { $set: data };
  if (password || data.role) update.$inc = { tokenVersion: 1 };
  return publicUser(requireFound(await repository.update(id, update)));
}
export async function remove(actor: Actor, id: string) {
  if (String(actor._id) === id) throw fail(400, 'Administrators cannot delete themselves');
  // Retain notes for administrator review and public posts after account deletion.
  // No cascading writes or transaction requirement; deleted accounts cannot authenticate.
  requireFound(await repository.remove(id));
}
export async function byInterest(page: Page, members: Page) {
  const result = await repository.byInterest(page, members);
  const data = result.data.map(group => ({ ...group, memberPagination: { page: members.page, limit: members.limit, total: group.totalUsers, pages: Math.ceil(group.totalUsers / members.limit) } }));
  return pageResult(data, result.metadata[0]?.total ?? 0, page);
}
