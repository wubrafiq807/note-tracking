import type { HydratedDocument, Types } from 'mongoose';
import type { UserRecord } from './models.js';

export interface Page { page: number; limit: number; skip: number }
export interface Actor { _id: Types.ObjectId; role: string }
export type SessionUser = HydratedDocument<UserRecord>;

declare global {
  namespace Express {
    interface Request {
      user: SessionUser;
      page: Page;
      members: Page;
    }
  }
}
