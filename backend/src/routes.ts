import { Router, type RequestHandler } from 'express';
import type { AuthService } from './services/auth.service.js';
import * as middleware from './middleware/index.js';
import * as input from './validation.js';
import { createAuthController } from './controllers/auth.controller.js';
import * as notes from './controllers/note.controller.js';
import * as users from './controllers/user.controller.js';
import * as posts from './controllers/post.controller.js';

export function createRoutes(authService: AuthService, enableRateLimit: boolean) {
  const router = Router();
  const auth = createAuthController(authService);
  const authenticate = middleware.authenticate(authService);
  const { admin, validate, paginate, paginateMembers } = middleware;
  const authLimiter: RequestHandler = enableRateLimit ? middleware.limiter(15 * 60000, 30) : (req, res, next) => next();
  router.param('id', middleware.validateId);
  router.post('/auth/register', authLimiter, validate(input.registerInput), auth.register);
  router.post('/auth/login', authLimiter, validate(input.loginInput), auth.login);
  router.get('/auth/me', authenticate, auth.me);
  router.post('/auth/logout', authenticate, auth.logout);
  router.get('/notes', authenticate, paginate, notes.list);
  router.post('/notes', authenticate, validate(input.noteInput), notes.create);
  router.get('/notes/:id', authenticate, notes.find);
  router.patch('/notes/:id', authenticate, validate(input.noteUpdate), notes.update);
  router.delete('/notes/:id', authenticate, notes.remove);
  router.get('/admin/notes', authenticate, admin, paginate, notes.listAll);
  router.get('/admin/users', authenticate, admin, paginate, users.list);
  router.post('/admin/users', authenticate, admin, validate(input.userInput), users.create);
  router.get('/admin/users/by-interest', authenticate, admin, paginate, paginateMembers, users.byInterest);
  router.get('/admin/users/:id', authenticate, admin, users.find);
  router.patch('/admin/users/:id', authenticate, admin, validate(input.userUpdate), users.update);
  router.delete('/admin/users/:id', authenticate, admin, users.remove);
  router.get('/posts', paginate, posts.list);
  router.post('/posts', authenticate, validate(input.postInput), posts.create);
  router.get('/posts/:id', posts.find);
  router.get('/users/:id/posts', paginate, posts.forUser);
  return router;
}
