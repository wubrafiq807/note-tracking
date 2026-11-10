import * as repository from '../repositories/post.repository.js';
import { requireFound } from '../errors.js';
import { pageResult } from '../validation.js';
import type { PostInput } from '../validation.js';
import type { Actor, Page } from '../types.js';

export async function list(page: Page) {
  const { data, total } = await repository.list(page);
  return pageResult(data, total, page);
}
export const create = (user: Actor, data: PostInput) => repository.create({ ...data, author: user._id });
export async function find(id: string) { return requireFound(await repository.find(id)); }
export async function forUser(id: string, page: Page) {
  const user = requireFound(await repository.forUser(id, page));
  const result = user.posts[0];
  return { ...pageResult(result?.data ?? [], result?.metadata[0]?.total ?? 0, page), author: { _id: user._id, name: user.name } };
}
