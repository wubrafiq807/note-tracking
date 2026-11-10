import { Note } from '../models.js';
import type { Types } from 'mongoose';
import type { Page } from '../types.js';
import type { NoteInput, NoteUpdate } from '../validation.js';
type NoteFilter = { owner?: Types.ObjectId; _id?: string };

export async function list(filter: NoteFilter, page: Page) {
  const [data, total] = await Promise.all([
    Note.find(filter).sort({ _id: -1 }).skip(page.skip).limit(page.limit).lean(),
    Note.countDocuments(filter).hint(Object.keys(filter).length ? { owner: 1, _id: -1 } : '_id_'),
  ]);
  return { data, total };
}
export const create = (data: NoteInput & { owner: Types.ObjectId }) => Note.create(data);
export const find = (filter: NoteFilter) => Note.findOne(filter).lean();
export const update = (filter: NoteFilter, data: NoteUpdate) => Note.findOneAndUpdate(filter, { $set: data }, { returnDocument: 'after', runValidators: true });
export const remove = (filter: NoteFilter) => Note.findOneAndDelete(filter);
