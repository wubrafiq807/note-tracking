import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { fail } from '../errors.js';
import { pagination } from '../validation.js';
import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import type { ZodType } from 'zod';
import type { AuthService } from '../services/auth.service.js';

export const validate = (schema: ZodType): RequestHandler => (req, res, next) => { req.body = schema.parse(req.body); next(); };
export const paginate: RequestHandler = (req, res, next) => { req.page = pagination(req.query); next(); };
export const paginateMembers: RequestHandler = (req, res, next) => {
  req.members = pagination({ page: req.query.memberPage, limit: req.query.memberLimit }); next();
};
export const authenticate = (authService: AuthService): RequestHandler => async (req, res, next) => {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) throw fail(401, 'Authentication required');
  req.user = await authService.authenticate(header.slice(7)); next();
};
export function admin(req: Request, res: Response, next: NextFunction) {
  if (req.user.role !== 'admin') throw fail(403, 'Administrator access required'); next();
}
export function validateId(req: Request, res: Response, next: NextFunction, id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw fail(400, 'Invalid ID');
  req.params.id = id.toLowerCase(); next();
}
export const limiter = (windowMs: number, limit: number) => rateLimit({ windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Too many requests; try again later' } });
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: 'Validation failed', details: error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) });
  if (error.code === 11000) return res.status(409).json({ error: 'Email is already registered' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (!error.status) console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Internal server error' });
}
