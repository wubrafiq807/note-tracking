import { Post, User } from '../models.js';
import { userPostsPipeline } from '../aggregations.js';
import type { Page } from '../types.js';
import type { PostInput } from '../validation.js';
import type { Types } from 'mongoose';

export async function list(page: Page) {
  const [data, total] = await Promise.all([
    Post.find().sort({ _id: -1 }).skip(page.skip).limit(page.limit).lean(),
    Post.countDocuments().hint('_id_'),
  ]);
  return { data, total };
}
export const create = (data: PostInput & { author: Types.ObjectId }) => Post.create(data);
export const find = (id: string) => Post.findById(id).lean();
interface UserPostsResult {
  _id: Types.ObjectId;
  name: string;
  posts: { data: (PostInput & { _id: Types.ObjectId; author: Types.ObjectId })[]; metadata: { total: number }[] }[];
}
export async function forUser(id: string, page: Page) {
  // Scenario 2: one aggregation pipeline, with indexed $lookup into Posts.
  const [user] = await User.aggregate<UserPostsResult>(userPostsPipeline(id, page));
  return user;
}
