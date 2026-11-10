import type { AuthService } from '../services/auth.service.js';
import type { Request, Response } from 'express';
import { publicUser } from '../validation.js';

export const createAuthController = (service: AuthService) => ({
  register: async (req: Request<{ id: string }>, res: Response) => res.status(201).json(await service.register(req.body)),
  login: async (req: Request<{ id: string }>, res: Response) => res.json(await service.login(req.body)),
  me: (req: Request<{ id: string }>, res: Response) => res.json({ user: publicUser(req.user) }),
  logout: async (req: Request<{ id: string }>, res: Response) => { await service.logout(req.user._id); res.sendStatus(204); },
});
