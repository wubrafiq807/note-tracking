# Secure Notes

A REST API and a minimal React frontend, written from scratch without a template. The focus is authentication, authorization, aggregation, and a small, justified set of indexes.

## Requirements and setup

- Node.js 22 or newer, npm, and MongoDB 8 (local, Atlas, or Docker).
- Backend: Express 5, TypeScript, Mongoose, JWT, bcrypt (cost 12), Zod.
- Frontend: React, TypeScript, Vite, plain CSS.

```sh
npm run install:all
```

Both `backend/.env` and `frontend/.env` exist locally and are ignored by Git. For a fresh clone:

```sh
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Set a random `JWT_SECRET` of at least 32 bytes in `backend/.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Start MongoDB using your own installation/Atlas connection or the included local-only Docker service:

```sh
docker compose up -d
```

Set `MONGODB_URI` in `backend/.env`. Start the backend and frontend in separate terminals:

```sh
npm --prefix backend run dev
```

```sh
npm --prefix frontend run dev
```

Open [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:3000/api](http://localhost:3000/api).

If Atlas startup fails with `querySrv ECONNREFUSED`, Node cannot resolve the cluster's DNS SRV records. You can keep your existing Atlas URI and add `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` to `backend/.env`, then restart the backend. This overrides DNS only in the backend Node process when using an SRV URI; no system network settings are changed. Leave it empty on networks requiring their own DNS resolver. Alternatively, copy Atlas's standard non-SRV connection string from its Connect dialog. See [Mongoose's DNS troubleshooting guidance](https://mongoosejs.com/docs/faq.html).

`FRONTEND_ORIGIN` in the backend and `VITE_API_URL` in the frontend must match your URLs. Vite variables are public and embedded at build time; database credentials and JWT secrets belong only in the backend environment.

To create the first administrator, set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ characters, maximum 72 UTF-8 bytes), and optionally `ADMIN_NAME` in `backend/.env`, then run:

```sh
npm --prefix backend run seed:admin
```

The seed refuses to overwrite or promote an existing email. Remove the seed credentials from your environment afterward. Public registration always creates a regular user.

If the seed cannot establish TLS but Compass already has a working connection, run `npm --prefix backend run seed:admin:query`. This offline helper generates `backend/.cache/admin-bootstrap.mongodb.js` using the configured email, name, and a bcrypt cost-12 password hash. Open Compass's **Open MongoDB shell**, paste the generated file's contents, and execute them through its existing connection. The query targets the database in `MONGODB_URI`, creates only the configured admin, and refuses to overwrite an existing account. The generated file is ignored by Git and contains no plaintext password. This is a recovery option, not an unauthenticated bootstrap API.

## Architecture

```text
backend/
  .env                  # local secrets, ignored
  .env.example
  src/
    routes.ts           # route wiring and middleware order
    middleware/         # authentication, roles, validation, pagination, errors
    controllers/        # HTTP input/output only
    services/           # ownership and business rules, hashing and JWTs
    repositories/       # Mongoose queries and aggregation execution
    models.ts           # schemas and explicit schema.index definitions
    db/connection.ts    # MongoDB connection and index initialization
    aggregations.ts     # pure pipeline builders used by repositories
    types.ts
  scripts/seed-admin.ts
  test/api.test.ts
frontend/
  .env                  # local API URL, ignored
  .env.example
  src/api.ts            # typed API client; attaches Bearer token
  src/main.tsx          # React forms and paginated views
```

Request flow: **middleware → controller → service → repository → model → database**. Database operations stay in repositories; the connection lifecycle stays in the DB layer. The diagnostic integration tests inspect models directly to verify physical indexes and explain plans.

## Permissions and security

- Users create, list, read, edit, and delete their own private notes.
- Admins retain those capabilities for their own notes, manage users, and read all notes. Admins cannot edit/delete other users' notes.
- Posts are public, including anonymous reads; creating a post requires authentication. User emails and private profiles are not exposed through public post endpoints.
- Passwords use bcrypt with cost 12. Password inputs are bounded by UTF-8 byte length to prevent bcrypt truncation. Login errors are generic and missing-account checks still compare a dummy hash.
- JWTs expire in one hour and validate the signing algorithm, issuer, and audience. Every protected request loads the current user and checks `tokenVersion`. Logout revokes every session for that account; password/role changes revoke old tokens; deleting an account immediately prevents future authentication.
- JWTs stay in React memory, so a browser refresh requires sign-in. They are not stored in localStorage. Use HTTPS for deployment.
- Input schemas reject unknown body fields and operator objects. Note ownership comes from the authenticated user. Failed ownership checks return 404. React renders content as text.
- Helmet, JSON size limits, API/login rate limits, exact-origin CORS, safe error responses, and no-store API caching are enabled. If deploying behind a proxy, configure Express `trust proxy` for that actual topology before relying on IP rate limiting.
- Admins cannot delete or demote themselves. Account deletion intentionally retains private notes for admin review and public posts; their original author ID remains attached. The per-user post endpoint returns 404 for a deleted user; retained posts remain accessible through the public feed.

## REST API

Send `Authorization: Bearer <token>` for authenticated endpoints. JSON error bodies contain `error`; validation errors also include `details`.

| Method | Endpoint | Access / behavior |
|---|---|---|
| POST | `/api/auth/register` | Public: `{name,email,password,interests}`; all fields required, at least one interest |
| POST | `/api/auth/login` | Public: `{email,password}`; returns token and safe user |
| GET | `/api/auth/me` | Current safe user profile |
| POST | `/api/auth/logout` | Revoke account sessions |
| GET | `/api/notes` | Own notes, paginated |
| POST | `/api/notes` | Create own note: `{title,content?}` |
| GET | `/api/notes/:id` | Owner or admin |
| PATCH | `/api/notes/:id` | Owner: `{title?,content?}` |
| DELETE | `/api/notes/:id` | Owner |
| GET | `/api/admin/notes` | Admin: everyone's notes, paginated |
| GET | `/api/admin/users` | Admin: all users, paginated |
| POST | `/api/admin/users` | Admin: `{name,email,password,role?,interests?}` |
| GET | `/api/admin/users/:id` | Admin: user profile |
| PATCH | `/api/admin/users/:id` | Admin: any nonempty subset of create fields |
| DELETE | `/api/admin/users/:id` | Admin: remove account, retain authored content |
| GET | `/api/admin/users/by-interest` | Admin: paginated groups and member pages |
| GET | `/api/posts` | Public: paginated public feed |
| POST | `/api/posts` | Authenticated: `{title,content}` |
| GET | `/api/posts/:id` | Public: one post |
| GET | `/api/users/:id/posts` | Public: user's posts through `$lookup`, paginated |

All lists accept `page` (default 1, max 10,000) and `limit` (default 10, max 100). Numeric values must be positive integers. Responses use:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 10, "total": 0, "pages": 0 }
}
```

Lists sort by `_id` descending; users within an interest sort ascending and groups sort by interest ascending. This gives deterministic ordering without another timestamp index. Offset pagination is bounded but becomes more expensive at large offsets; totals and pages from separate normal queries can change during concurrent writes.

Interest grouping additionally accepts `memberPage` and `memberLimit` (same defaults/bounds). Each group contains `interest`, `totalUsers`, a bounded `users` array, and `memberPagination`. Members are independently paginated to avoid unbounded `$push` arrays. Users with no interests do not appear in a group. Interests are trimmed, lowercased, and deduplicated on input.

## Index strategy

Every custom index is explicitly declared with `schema.index()` in `backend/src/models.ts`. MongoDB supplies `_id_` automatically; the code does not redeclare it.

| Collection | Index | Required query |
|---|---|---|
| Users | `{email:1}`, unique | Exact email login and duplicate-account protection |
| Users | `{interests:1,_id:1}` | Equality membership join followed by stable user ordering inside interest-group `$lookup`; multikey because interests is an array |
| Notes | `{owner:1,_id:-1}` | Own-note equality filter, descending page order, and matching count |
| Posts | `{author:1,_id:-1}` | User-to-post equality `$lookup`, descending page order and matching count |
| All | Built-in `{_id:1}` | Direct GETs, current-profile authentication, unfiltered admin/public lists and their counts |

No separate indexes on role, title, body, timestamps, owner alone, or author alone are necessary. `_id` uniquely locates a note before checking its owner on direct reads and writes; an extra owner+note-ID index for that path would duplicate existing coverage. Compound owner/author prefixes already cover equality counts.

**Scenario 1:** `user.repository.ts` executes exactly one `User.collection.aggregate(...).toArray()` call, without find/count/distinct calls. `$unwind` and `$group` calculate all interest counts. `$facet` returns total groups and a page. Only that page performs concise equality `$lookup` membership joins, whose foreign field uses the interests compound index. Grouping all users inherently visits all source interests; a B-tree cannot eliminate this work or index the computed group sort. An extra index solely for `$unwind`/`$group` would be unnecessary. The membership join uses `localField`/`foreignField`, avoiding a multikey `$expr` lookup.

**Scenario 2:** `post.repository.ts` executes one user aggregation. `$match` selects the user by built-in `_id_`; `$lookup` joins Posts on author. Its pipeline sorts by `_id` then uses `$facet` for a bounded posts page and total. It never loads an unbounded user's post array or makes a second post query.

The integration suite runs real MongoDB `explain('executionStats')` queries and asserts the index names used by login, direct reads, all unfiltered lists, own-note listing, and both `$lookup` queries. The global grouping scan is expected and documented.

References: [MongoDB `$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/), [MongoDB multikey indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/), [Mongoose schemas/indexes](https://mongoosejs.com/docs/guide.html).

## Verification and builds

```sh
npm run check
npm test
npm run build
```

Tests start a disposable real MongoDB using `mongodb-memory-server`; the first run downloads its MongoDB binary and requires network access. No mocked database or production database is used. Tests cover authentication, password safety, input rejection, ownership, admin rights, session revocation, pagination, exact aggregation call counts, and explain plans. Tests explicitly disable rate limiting; the runtime enables it.

For production, run `npm --prefix backend run build` then `npm --prefix backend start`. Serve `frontend/dist` with a static host after `npm --prefix frontend run build`, and configure its origin in `backend/.env`. The backend and frontend remain separately runnable projects.
