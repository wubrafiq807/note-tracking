import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as repository from '../repositories/auth.repository.js';
import { publicUser } from '../validation.js';
import { fail } from '../errors.js';
import type { SessionUser } from '../types.js';
import type { RegisterInput, LoginInput } from '../validation.js';
import type { Types } from 'mongoose';

const issuer = 'secure-notes';
const audience = 'secure-notes-web';
const dummyHash = await bcrypt.hash('invalid-login-placeholder', 12);
export function createAuthService(secret: string | undefined) {
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('JWT_SECRET must contain at least 32 bytes');
  const signingSecret = secret;
  function session(user: SessionUser) {
    return { user: publicUser(user), token: jwt.sign({ ver: user.tokenVersion ?? 0 }, signingSecret, { subject: String(user._id), expiresIn: '1h', algorithm: 'HS256', issuer, audience }) };
  }
  return {
    async register({ password, ...data }: RegisterInput) {
      const user = await repository.createUser({ ...data, passwordHash: await bcrypt.hash(password, 12) });
      return session(user);
    },
    async login({ email, password }: LoginInput) {
      const user = await repository.findLogin(email);
      const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
      if (!user || !valid) throw fail(401, 'Invalid email or password');
      return session(user);
    },
    async authenticate(token: string) {
      let payload;
      try { payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience }); }
      catch { throw fail(401, 'Invalid or expired token'); }
      if (typeof payload === 'string' || !payload.sub || !/^[a-f\d]{24}$/i.test(payload.sub)) throw fail(401, 'Invalid token');
      const user = await repository.findSession(payload.sub);
      if (!user || user.tokenVersion !== payload.ver) throw fail(401, 'Session revoked');
      return user;
    },
    async logout(id: Types.ObjectId) { await repository.revokeSessions(id); },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
