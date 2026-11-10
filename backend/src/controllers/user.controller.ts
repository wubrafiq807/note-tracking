import type { Request, Response } from 'express';
import * as service from '../services/user.service.js';

export const list = async (req: Request<{ id: string }>, res: Response) => res.json(await service.list(req.page));
export const create = async (req: Request<{ id: string }>, res: Response) => res.status(201).json({ user: await service.create(req.body) });
export const find = async (req: Request<{ id: string }>, res: Response) => res.json({ user: await service.find(req.params.id) });
export const update = async (req: Request<{ id: string }>, res: Response) => res.json({ user: await service.update(req.user, req.params.id, req.body) });
export const remove = async (req: Request<{ id: string }>, res: Response) => { await service.remove(req.user, req.params.id); res.sendStatus(204); };
export const byInterest = async (req: Request<{ id: string }>, res: Response) => res.json(await service.byInterest(req.page, req.members));
