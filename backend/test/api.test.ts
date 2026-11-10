import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { User, Note, Post } from '../src/models.js';
import { interestPipeline, userPostsPipeline } from '../src/aggregations.js';

const secret = 'integration-test-secret-with-at-least-32-bytes';
const password = 'correct-horse-battery-42';
const app = createApp({ jwtSecret: secret, enableRateLimit: false });
let mongo: MongoMemoryServer;
let alice: { _id: string; token: string };
let bob: { _id: string; token: string };
let admin: { _id: string; token: string };
let aliceNote: string;
const bearer = (token: string) => `Bearer ${token}`;
const page = { page: 1, limit: 10, skip: 0 };

before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '8.0.17', downloadDir: fileURLToPath(new URL('../../.cache/mongodb-binaries', import.meta.url)) } });
  await connectDatabase(mongo.getUri());
  for (const [name, interests] of [['Alice', ['chess', 'reading']], ['Bob', ['chess']]] as const) {
    const response = await request(app).post('/api/auth/register').send({ name, email: `${name.toLowerCase()}@example.com`, password, interests });
    assert.equal(response.status, 201);
    const account = { _id: response.body.user._id, token: response.body.token };
    if (name === 'Alice') alice = account; else bob = account;
  }
  const user = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: await bcrypt.hash(password, 12), role: 'admin' });
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password });
  admin = { _id: String(user._id), token: login.body.token };
}, { timeout: 240000 });
after(async () => { await disconnectDatabase(); await mongo?.stop(); });

describe('authentication and input security', () => {
  it('hashes passwords and never returns password hashes or token versions', async () => {
    const stored = await User.findById(alice._id).select('+passwordHash');
    assert.notEqual(stored!.passwordHash, password);
    assert.equal(await bcrypt.compare(password, stored!.passwordHash), true);
    const result = await request(app).get('/api/auth/me').set('Authorization', bearer(alice.token)).expect(200);
    assert.equal(result.body.user.passwordHash, undefined);
    assert.equal(result.body.user.tokenVersion, undefined);
  });
  it('rejects public role escalation, duplicate emails and operator injection', async () => {
    await request(app).post('/api/auth/register').send({ name: 'Evil', email: 'evil@example.com', password, role: 'admin' }).expect(400);
    await request(app).post('/api/auth/register').send({ name: 'Duplicate', email: 'ALICE@example.com', password, interests: ['reading'] }).expect(409);
    await request(app).post('/api/auth/login').send({ email: { $ne: '' }, password }).expect(400);
    await request(app).post('/api/auth/register').send({ name: 'Long', email: 'long@example.com', password: 'é'.repeat(40) }).expect(400);
  });
  it('rejects missing, invalid, expired and incorrectly signed JWTs', async () => {
    await request(app).get('/api/notes').expect(401);
    await request(app).get('/api/notes').set('Authorization', 'Bearer invalid').expect(401);
    const expired = jwt.sign({ ver: 0 }, secret, { subject: alice._id, issuer: 'secure-notes', audience: 'secure-notes-web', expiresIn: -1 });
    await request(app).get('/api/notes').set('Authorization', bearer(expired)).expect(401);
    const wrong = jwt.sign({ ver: 0 }, 'a-different-secret', { subject: alice._id });
    await request(app).get('/api/notes').set('Authorization', bearer(wrong)).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'incorrect' }).expect(401);
  });
  it('requires a name, email, password and nonempty interests for registration', async () => {
    const valid = { name: 'Required fields', email: 'required@example.com', password, interests: ['reading'] };
    for (const field of ['name', 'email', 'password', 'interests']) {
      const missing: Record<string, unknown> = { ...valid };
      delete missing[field];
      const response = await request(app).post('/api/auth/register').send(missing).expect(400);
      assert.ok(response.body.details.some((issue: { path: string }) => issue.path === field));
    }
    for (const interests of [[], [''], ['   ']]) {
      await request(app).post('/api/auth/register').send({ ...valid, interests }).expect(400);
    }
    for (const name of ['', '   ']) {
      await request(app).post('/api/auth/register').send({ ...valid, name }).expect(400);
    }
    assert.equal(await User.countDocuments({ email: valid.email }), 0);
  });
  it('rejects malformed JSON, IDs and pagination', async () => {
    await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
    await request(app).get('/api/notes/invalid').set('Authorization', bearer(alice.token)).expect(400);
    for (const query of ['page=0', 'limit=101', 'page=1.2', 'page=abc', 'page=1&page=2', 'limit[$gt]=1']) {
      await request(app).get(`/api/notes?${query}`).set('Authorization', bearer(alice.token)).expect(400);
    }
    await request(app).get('/api/unknown').expect(404);
  });
  it('allows only the configured frontend origin in CORS', async () => {
    const allowed = await request(app).options('/api/notes').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'GET');
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');
    const foreign = await request(app).get('/api/posts').set('Origin', 'https://other.example');
    assert.notEqual(foreign.headers['access-control-allow-origin'], 'https://other.example');
    assert.equal(foreign.headers['cache-control'], 'no-store');
  });
  it('enforces the runtime authentication rate limit', async () => {
    const limitedApp = createApp({ jwtSecret: secret });
    for (let i = 0; i < 30; i++) await request(limitedApp).post('/api/auth/login').send({}).expect(400);
    const blocked = await request(limitedApp).post('/api/auth/login').send({}).expect(429);
    assert.equal(blocked.body.error, 'Too many requests; try again later');
  });
});

describe('note ownership and pagination', () => {
  it('creates notes, binds ownership server-side and isolates list results', async () => {
    const response = await request(app).post('/api/notes').set('Authorization', bearer(alice.token)).send({ title: 'Private Alice', content: 'secret' }).expect(201);
    aliceNote = response.body.note._id;
    await request(app).post('/api/notes').set('Authorization', bearer(alice.token)).send({ title: 'Spoof', owner: bob._id }).expect(400);
    await request(app).post('/api/notes').set('Authorization', bearer(bob.token)).send({ title: 'Private Bob' }).expect(201);
    const list = await request(app).get('/api/notes').set('Authorization', bearer(alice.token)).expect(200);
    assert.equal(list.body.pagination.total, 1);
    assert.equal(list.body.data[0].owner, alice._id);
    const other = await request(app).get('/api/notes').set('Authorization', bearer(bob.token)).expect(200);
    assert.equal(other.body.data.length, 1);
    assert.equal(other.body.data[0].title, 'Private Bob');
  });
  it('prevents cross-user reads, updates and deletes, including admin writes', async () => {
    for (const method of ['get', 'patch', 'delete'] as const) {
      await request(app)[method](`/api/notes/${aliceNote}`).set('Authorization', bearer(bob.token)).send(method === 'patch' ? { title: 'Stolen' } : undefined).expect(404);
    }
    await request(app).get(`/api/notes/${aliceNote}`).set('Authorization', bearer(admin.token)).expect(200);
    await request(app).patch(`/api/notes/${aliceNote}`).set('Authorization', bearer(admin.token)).send({ title: 'Admin overwrite' }).expect(404);
    await request(app).delete(`/api/notes/${aliceNote}`).set('Authorization', bearer(admin.token)).expect(404);
  });
  it('updates own notes and returns stable non-overlapping pages', async () => {
    const edited = await request(app).patch(`/api/notes/${aliceNote}`).set('Authorization', bearer(alice.token)).send({ content: 'edited' }).expect(200);
    assert.equal(edited.body.note.content, 'edited');
    const titleOnly = await request(app).patch(`/api/notes/${aliceNote}`).set('Authorization', bearer(alice.token)).send({ title: 'New title' }).expect(200);
    assert.equal(titleOnly.body.note.content, 'edited');
    await request(app).patch(`/api/notes/${aliceNote}`).set('Authorization', bearer(alice.token)).send({}).expect(400);
    await Note.insertMany(Array.from({ length: 23 }, (_, i) => ({ owner: alice._id, title: `Note ${i}` })));
    const first = await request(app).get('/api/notes?page=1&limit=10').set('Authorization', bearer(alice.token)).expect(200);
    const second = await request(app).get('/api/notes?page=2&limit=10').set('Authorization', bearer(alice.token)).expect(200);
    assert.equal(first.body.pagination.total, 24);
    assert.equal(first.body.pagination.pages, 3);
    assert.equal(first.body.data.length, 10);
    assert.equal(second.body.data.length, 10);
    assert.equal(first.body.data.some((a: { _id: string }) => second.body.data.some((b: { _id: string }) => a._id === b._id)), false);
    const beyond = await request(app).get('/api/notes?page=99').set('Authorization', bearer(alice.token)).expect(200);
    assert.deepEqual(beyond.body.data, []);
  });
  it('lets admins list everyone’s notes and create/update/delete their own', async () => {
    await request(app).get('/api/admin/notes').set('Authorization', bearer(alice.token)).expect(403);
    const all = await request(app).get('/api/admin/notes?limit=100').set('Authorization', bearer(admin.token)).expect(200);
    assert.equal(all.body.pagination.total, 25);
    const created = await request(app).post('/api/notes').set('Authorization', bearer(admin.token)).send({ title: 'Admin own' }).expect(201);
    await request(app).patch(`/api/notes/${created.body.note._id}`).set('Authorization', bearer(admin.token)).send({ title: 'Updated' }).expect(200);
    await request(app).delete(`/api/notes/${created.body.note._id}`).set('Authorization', bearer(admin.token)).expect(204);
    await request(app).get(`/api/notes/${created.body.note._id}`).set('Authorization', bearer(admin.token)).expect(404);
  });
});

describe('administration and session invalidation', () => {
  it('restricts all user management endpoints to administrators', async () => {
    for (const path of ['/api/admin/users', '/api/admin/users/by-interest', `/api/admin/users/${bob._id}`]) {
      await request(app).get(path).set('Authorization', bearer(alice.token)).expect(403);
    }
    await request(app).post('/api/admin/users').set('Authorization', bearer(alice.token)).send({}).expect(403);
    await request(app).patch(`/api/admin/users/${bob._id}`).set('Authorization', bearer(alice.token)).send({ name: 'Bad' }).expect(403);
    await request(app).delete(`/api/admin/users/${bob._id}`).set('Authorization', bearer(alice.token)).expect(403);
  });
  it('adds, reads, updates, paginates and removes users without leaking hashes', async () => {
    const created = await request(app).post('/api/admin/users').set('Authorization', bearer(admin.token)).send({ name: 'Temporary', email: 'temp@example.com', password, interests: ['CHESS', 'chess'] }).expect(201);
    const id = created.body.user._id;
    assert.deepEqual(created.body.user.interests, ['chess']);
    assert.equal(created.body.user.passwordHash, undefined);
    await request(app).get(`/api/admin/users/${id}`).set('Authorization', bearer(admin.token)).expect(200);
    const login = await request(app).post('/api/auth/login').send({ email: 'temp@example.com', password }).expect(200);
    await request(app).patch(`/api/admin/users/${id}`).set('Authorization', bearer(admin.token)).send({ name: 'Changed', password: 'another-valid-password' }).expect(200);
    await request(app).get('/api/auth/me').set('Authorization', bearer(login.body.token)).expect(401);
    const updatedLogin = await request(app).post('/api/auth/login').send({ email: 'temp@example.com', password: 'another-valid-password' }).expect(200);
    const users = await request(app).get('/api/admin/users?limit=2').set('Authorization', bearer(admin.token)).expect(200);
    assert.equal(users.body.data.length, 2);
    assert.equal(users.body.pagination.total, 4);
    assert.ok(users.body.data.every((u: Record<string, unknown>) => !('passwordHash' in u) && !('tokenVersion' in u)));
    await request(app).delete(`/api/admin/users/${id}`).set('Authorization', bearer(admin.token)).expect(204);
    await request(app).get('/api/auth/me').set('Authorization', bearer(updatedLogin.body.token)).expect(401);
    await request(app).get(`/api/admin/users/${id}`).set('Authorization', bearer(admin.token)).expect(404);
  });
  it('rejects self-deletion and self-demotion with case-insensitive ObjectIds', async () => {
    await request(app).delete(`/api/admin/users/${admin._id.toUpperCase()}`).set('Authorization', bearer(admin.token)).expect(400);
    await request(app).patch(`/api/admin/users/${admin._id.toUpperCase()}`).set('Authorization', bearer(admin.token)).send({ role: 'user' }).expect(400);
  });
  it('revokes old tokens after role changes and logout', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password });
    await request(app).patch(`/api/admin/users/${bob._id}`).set('Authorization', bearer(admin.token)).send({ role: 'admin' }).expect(200);
    await request(app).get('/api/auth/me').set('Authorization', bearer(login.body.token)).expect(401);
    await request(app).patch(`/api/admin/users/${bob._id}`).set('Authorization', bearer(admin.token)).send({ role: 'user' }).expect(200);
    const fresh = await request(app).post('/api/auth/login').send({ email: 'bob@example.com', password }).expect(200);
    bob.token = fresh.body.token;
    await request(app).post('/api/auth/logout').set('Authorization', bearer(bob.token)).expect(204);
    await request(app).get('/api/auth/me').set('Authorization', bearer(bob.token)).expect(401);
  });
});

describe('aggregation scenarios and indexes', () => {
  it('groups users by interests using exactly one collection.aggregate call, with group and member pagination', async t => {
    const aggregate = t.mock.method(User.collection, 'aggregate');
    const result = await request(app).get('/api/admin/users/by-interest?limit=1&memberLimit=1').set('Authorization', bearer(admin.token)).expect(200);
    assert.equal(aggregate.mock.callCount(), 1);
    aggregate.mock.restore();
    assert.equal(result.body.pagination.total, 2);
    assert.equal(result.body.data[0].interest, 'chess');
    assert.equal(result.body.data[0].totalUsers, 2);
    assert.equal(result.body.data[0].users.length, 1);
    const nextMember = await request(app).get('/api/admin/users/by-interest?limit=1&memberLimit=1&memberPage=2').set('Authorization', bearer(admin.token)).expect(200);
    assert.notEqual(nextMember.body.data[0].users[0]._id, result.body.data[0].users[0]._id);
    const nextGroup = await request(app).get('/api/admin/users/by-interest?limit=1&page=2').set('Authorization', bearer(admin.token)).expect(200);
    assert.equal(nextGroup.body.data[0].interest, 'reading');
  });
  it('retrieves one user’s public posts with a single indexed $lookup pipeline', async t => {
    await request(app).post('/api/posts').send({ title: 'Anonymous', content: 'Denied' }).expect(401);
    const created = await request(app).post('/api/posts').set('Authorization', bearer(alice.token)).send({ title: 'Public Alice', content: 'Visible to everyone' }).expect(201);
    await Post.create({ author: bob._id, title: 'Public Bob', content: 'Other author' });
    await Post.insertMany(Array.from({ length: 12 }, (_, i) => ({ author: alice._id, title: `Post ${i}`, content: 'Public' })));
    const aggregate = t.mock.method(User, 'aggregate');
    const own = await request(app).get(`/api/users/${alice._id}/posts?limit=5`).expect(200);
    assert.equal(aggregate.mock.callCount(), 1);
    aggregate.mock.restore();
    assert.equal(own.body.pagination.total, 13);
    assert.equal(own.body.data.length, 5);
    assert.ok(own.body.data.every((post: { author: string }) => post.author === alice._id));
    const all = await request(app).get('/api/posts?limit=5').expect(200);
    assert.equal(all.body.pagination.total, 14);
    assert.equal(all.body.data.length, 5);
    await request(app).get(`/api/posts/${created.body.post._id}`).expect(200);
    await request(app).get(`/api/users/${admin._id}/posts`).expect(200).then(result => assert.deepEqual(result.body.data, []));
    await request(app).get(`/api/users/${new mongoose.Types.ObjectId()}/posts`).expect(404);
  });
  it('defines only the four justified secondary indexes', async () => {
    const userIndexes = await User.collection.indexes();
    const noteIndexes = await Note.collection.indexes();
    const postIndexes = await Post.collection.indexes();
    assert.deepEqual(userIndexes.map(i => i.name).sort(), ['_id_', 'email_1', 'interests_1__id_1'].sort());
    assert.deepEqual(noteIndexes.map(i => i.name).sort(), ['_id_', 'owner_1__id_-1'].sort());
    assert.deepEqual(postIndexes.map(i => i.name).sort(), ['_id_', 'author_1__id_-1'].sort());
  });
  it('verifies real query plans for list, login, reads and both lookup indexes', async () => {
    const notePlan = await Note.collection.find({ owner: new mongoose.Types.ObjectId(alice._id) }).sort({ _id: -1 }).limit(10).explain('executionStats');
    assert.match(JSON.stringify(notePlan.queryPlanner.winningPlan), /owner_1__id_-1/);
    const loginPlan = await User.collection.find({ email: 'alice@example.com' }).limit(1).explain('executionStats');
    assert.match(JSON.stringify(loginPlan.queryPlanner.winningPlan), /email_1/);
    const directPlan = await Note.collection.find({ _id: new mongoose.Types.ObjectId(aliceNote) }).limit(1).explain('executionStats');
    assert.match(JSON.stringify(directPlan.queryPlanner.winningPlan), /_id_/);
    for (const model of [User, Note, Post]) {
      const plan = await model.collection.find().sort({ _id: -1 }).limit(10).explain('executionStats');
      assert.match(JSON.stringify(plan.queryPlanner.winningPlan), /_id_/);
    }
    const postPlan = await User.aggregate(userPostsPipeline(alice._id, page)).explain('executionStats');
    assert.match(JSON.stringify(postPlan), /author_1__id_-1/);
    const interestPlan = await User.aggregate(interestPipeline(page, page)).explain('executionStats');
    assert.match(JSON.stringify(interestPlan), /interests_1__id_1/);
  });
});
