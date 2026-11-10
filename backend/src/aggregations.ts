import mongoose, { type PipelineStage } from 'mongoose';
import type { Page } from './types.js';

export function interestPipeline({ skip, limit }: Page, members: Page): PipelineStage[] {
  return [
    // All interests must be visited to compute exact group counts. No speculative index
    // is added to accelerate $unwind/$group, which cannot use an interests index here.
    { $project: { interests: 1 } },
    { $unwind: '$interests' },
    { $group: { _id: '$interests', totalUsers: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $facet: {
      metadata: [{ $count: 'total' }],
      data: [
        { $skip: skip }, { $limit: limit },
        { $lookup: {
          from: 'users', localField: '_id', foreignField: 'interests',
          pipeline: [
            { $sort: { _id: 1 } }, { $skip: members.skip }, { $limit: members.limit },
            { $project: { name: 1, email: 1, interests: 1, role: 1 } },
          ], as: 'users',
        } },
        { $project: { _id: 0, interest: '$_id', totalUsers: 1, users: 1 } },
      ],
    } },
  ];
}

export function userPostsPipeline(userId: string, { skip, limit }: Page): PipelineStage[] {
  return [
    { $match: { _id: new mongoose.Types.ObjectId(userId) } },
    { $lookup: {
      from: 'posts', localField: '_id', foreignField: 'author',
      pipeline: [
        { $sort: { _id: -1 } },
        { $facet: { data: [{ $skip: skip }, { $limit: limit }], metadata: [{ $count: 'total' }] } },
      ], as: 'posts',
    } },
    { $project: { _id: 1, name: 1, posts: 1 } },
  ];
}
