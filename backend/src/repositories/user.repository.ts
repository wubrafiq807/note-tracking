import { User } from '../models.js';
import { interestPipeline } from '../aggregations.js';
import type { Page } from '../types.js';
import type { UserInput } from '../validation.js';
import type { UserRecord } from '../models.js';
import type { UpdateQuery } from 'mongoose';

export async function list(page: Page) {
  const [data, total] = await Promise.all([
    User.find().sort({ _id: -1 }).skip(page.skip).limit(page.limit).lean(),
    User.countDocuments().hint('_id_'),
  ]);
  return { data, total };
}
export const create = (data: Omit<UserInput, 'password'> & { passwordHash: string }) => User.create(data);
export const find = (id: string) => User.findById(id).lean();
export const update = (id: string, update: UpdateQuery<UserRecord>) => User.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true });
export const remove = (id: string) => User.findByIdAndDelete(id);
export interface InterestResult {
  metadata: { total: number }[];
  data: { interest: string; totalUsers: number; users: { _id: string; name: string; email: string; role: string; interests: string[] }[] }[];
}
export async function byInterest(page: Page, members: Page) {
  // Scenario 1: exactly one collection.aggregate() call. No other collection method.
  const [result] = await User.collection.aggregate<InterestResult>(interestPipeline(page, members), { allowDiskUse: true }).toArray();
  return result;
}
