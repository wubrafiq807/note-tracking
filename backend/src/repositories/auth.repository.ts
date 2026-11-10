import { User } from '../models.js';
import type { Types } from 'mongoose';
import type { RegisterInput } from '../validation.js';

export const findLogin = (email: string) => User.findOne({ email }).select('+passwordHash +tokenVersion');
export const findSession = (id: string) => User.findById(id).select('+tokenVersion');
export const revokeSessions = (id: Types.ObjectId) => User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
export const createUser = (data: Omit<RegisterInput, 'password'> & { passwordHash: string }) => User.create(data);
