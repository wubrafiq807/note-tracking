import mongoose, { type InferSchemaType } from 'mongoose';

const { Schema } = mongoose;
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  interests: { type: [String], default: [] },
  tokenVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });
// Unique login lookup; not duplicated with a separate non-unique email index.
userSchema.index({ email: 1 }, { unique: true });
// Interest-group membership lookup, ordered by user ID, including member pagination.
userSchema.index({ interests: 1, _id: 1 });

const noteSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, default: '' },
}, { timestamps: true });
// Equality on owner followed by stable pagination order. Prefix also supports deletion by owner.
noteSchema.index({ owner: 1, _id: -1 });

const postSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
}, { timestamps: true });
// Supports the author equality join and sorted pages inside $lookup.
postSchema.index({ author: 1, _id: -1 });

// MongoDB's built-in unique _id indexes support all direct reads and unfiltered lists.
export type UserRecord = InferSchemaType<typeof userSchema>;
export const User = mongoose.model('User', userSchema);
export const Note = mongoose.model('Note', noteSchema);
export const Post = mongoose.model('Post', postSchema);

export async function initializeIndexes() {
  await Promise.all([User.init(), Note.init(), Post.init()]);
}
