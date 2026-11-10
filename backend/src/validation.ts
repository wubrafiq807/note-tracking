import { z } from 'zod';
import type { Page } from './types.js';
import type { UserRecord } from './models.js';
import type { Types } from 'mongoose';

const name = z.string().trim().min(1).max(100);
const email = z.email().max(254).transform(value => value.toLowerCase());
// bcrypt only consumes 72 bytes; reject rather than silently truncate passwords.
const password = z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');
const interests = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(20)
  .transform(value => [...new Set(value)]);
// Administrative provisioning can omit interests; public registration must supply one.
export const accountInput = z.strictObject({ name, email, password, interests: interests.default([]) });
export const registerInput = accountInput.extend({ interests: interests.refine(value => value.length > 0, 'Select at least one interest') });
export const loginInput = z.strictObject({ email, password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes') });
export const userInput = accountInput.extend({ role: z.enum(['user', 'admin']).default('user') });
export const userUpdate = z.strictObject({ name: name.optional(), email: email.optional(), password: password.optional(), interests: interests.optional(), role: z.enum(['user', 'admin']).optional() }).refine(value => Object.keys(value).length > 0, 'Provide at least one field');
export const noteInput = z.strictObject({ title: z.string().trim().min(1).max(200), content: z.string().max(20000).default('') });
// PATCH fields have no defaults: changing a title must preserve the existing content.
export const noteUpdate = z.strictObject({ title: noteInput.shape.title.optional(), content: z.string().max(20000).optional() }).refine(value => Object.keys(value).length > 0, 'Provide at least one field');
export const postInput = z.strictObject({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20000) });
const positiveInteger = (fallback: number, maximum: number) => z.preprocess(value => value === undefined ? fallback : value, z.coerce.number().int().min(1).max(maximum));
export const paginationInput = z.strictObject({ page: positiveInteger(1, 10000), limit: positiveInteger(10, 100), memberPage: z.unknown().optional(), memberLimit: z.unknown().optional() });
export function pagination(query: unknown): Page {
  const { page, limit } = paginationInput.parse(query);
  return { page, limit, skip: (page - 1) * limit };
}
export function pageResult<T>(data: T[], total: number, { page, limit }: Page) {
  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}
export function publicUser(user: Pick<UserRecord, 'name' | 'email' | 'role' | 'interests' | 'createdAt' | 'updatedAt'> & { _id: Types.ObjectId }) {
  const { _id, name, email, role, interests, createdAt, updatedAt } = user;
  return { _id, name, email, role, interests, createdAt, updatedAt };
}
export type RegisterInput = z.output<typeof registerInput>;
export type LoginInput = z.output<typeof loginInput>;
export type UserInput = z.output<typeof userInput>;
export type UserUpdate = z.output<typeof userUpdate>;
export type NoteInput = z.output<typeof noteInput>;
export type NoteUpdate = z.output<typeof noteUpdate>;
export type PostInput = z.output<typeof postInput>;
