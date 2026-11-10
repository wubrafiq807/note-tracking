import * as repository from '../repositories/note.repository.js';
import { requireFound } from '../errors.js';
import { pageResult } from '../validation.js';
import type { NoteInput, NoteUpdate } from '../validation.js';
import type { Actor, Page } from '../types.js';

export async function list(user: Actor, page: Page, all = false) {
  const { data, total } = await repository.list(all ? {} : { owner: user._id }, page);
  return pageResult(data, total, page);
}
export const create = (user: Actor, data: NoteInput) => repository.create({ ...data, owner: user._id });
export async function find(user: Actor, id: string) {
  return requireFound(await repository.find({ _id: id, ...(user.role === 'admin' ? {} : { owner: user._id }) }));
}
export async function update(user: Actor, id: string, data: NoteUpdate) {
  return requireFound(await repository.update({ _id: id, owner: user._id }, data));
}
export async function remove(user: Actor, id: string) {
  requireFound(await repository.remove({ _id: id, owner: user._id }));
}
