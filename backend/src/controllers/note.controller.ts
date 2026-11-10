import type { Request, Response } from 'express';
import * as service from '../services/note.service.js';

export const list = async (req: Request<{ id: string }>, res: Response) => res.json(await service.list(req.user, req.page));
export const listAll = async (req: Request<{ id: string }>, res: Response) => res.json(await service.list(req.user, req.page, true));
export const create = async (req: Request<{ id: string }>, res: Response) => res.status(201).json({ note: await service.create(req.user, req.body) });
export const find = async (req: Request<{ id: string }>, res: Response) => res.json({ note: await service.find(req.user, req.params.id) });
export const update = async (req: Request<{ id: string }>, res: Response) => res.json({ note: await service.update(req.user, req.params.id, req.body) });
export const remove = async (req: Request<{ id: string }>, res: Response) => { await service.remove(req.user, req.params.id); res.sendStatus(204); };
