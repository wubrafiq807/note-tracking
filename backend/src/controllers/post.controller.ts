import type { Request, Response } from 'express';
import * as service from '../services/post.service.js';

export const list = async (req: Request<{ id: string }>, res: Response) => res.json(await service.list(req.page));
export const create = async (req: Request<{ id: string }>, res: Response) => res.status(201).json({ post: await service.create(req.user, req.body) });
export const find = async (req: Request<{ id: string }>, res: Response) => res.json({ post: await service.find(req.params.id) });
export const forUser = async (req: Request<{ id: string }>, res: Response) => res.json(await service.forUser(req.params.id, req.page));
