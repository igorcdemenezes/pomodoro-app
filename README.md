# Pomodoro App

Productivity application built around the Pomodoro technique: organise projects
and tasks, run focus sessions and track productivity metrics.

> 🚧 **Work in progress.** Setup, API reference and architecture notes are being
> filled in as the implementation lands. The full technical plan — stack
> rationale, data model, API contract and testing strategy — is in
> [`docs/PLANO.md`](docs/PLANO.md).

## Architecture

```
📱 Expo / React Native  ──HTTPS──▶  ⚙️ NestJS API  ──▶  🗄️ PostgreSQL
```

The backend and the database are the single source of truth. The client renders
state and derives the running timer from server timestamps; it never decides
business rules such as whether a focus session may start.

## Stack

| Layer          | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| Mobile         | React Native (Expo), TypeScript, Expo Router, TanStack Query |
| Backend        | NestJS, TypeScript, Prisma, Swagger                          |
| Database       | PostgreSQL 16                                                |
| Infrastructure | Docker Compose                                               |

## Repository layout

| Path          | Contents                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `apps/api`    | NestJS backend: HTTP API, business rules, Prisma schema and migrations |
| `apps/mobile` | Expo client: screens, navigation, HTTP layer and offline cache         |
| `docs`        | Technical plan and design notes                                        |

## Getting started

### Requirements

- Node.js 24 (see `.nvmrc`)
- Docker with Compose v2

### Database

The database runs in Docker and is the only piece needed before the backend
exists. First start also provisions a separate `pomodoro_test` database used by
the integration test suite.

```bash
cp .env.example .env   # adjust credentials if you like
npm install            # workspace dependencies and git hooks
npm run db:up          # starts PostgreSQL 16 and waits for it to be healthy
```

Verify it is accepting connections:

```bash
docker compose ps                # postgres should report (healthy)
npm run db:psql -- -c '\l'       # lists pomodoro and pomodoro_test
```

| Script             | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `npm run db:up`    | Start PostgreSQL in the background                  |
| `npm run db:down`  | Stop the container, keeping the data volume         |
| `npm run db:reset` | Destroy the volume and start from an empty database |
| `npm run db:logs`  | Follow the database logs                            |
| `npm run db:psql`  | Open a `psql` shell inside the container            |

Data lives in the named volume `pomodoro-pgdata`, so it survives
`npm run db:down` and machine restarts. Only `npm run db:reset` discards it.

The container is published on host port **5433**, not the default 5432, because a
development machine often already has something bound to 5432. Override
`POSTGRES_PORT` in `.env` if 5433 is taken too — remember to update
`DATABASE_URL` and `TEST_DATABASE_URL` to match.

### Schema and migrations

```bash
npm run api migrate:deploy   # apply migrations
npm run api generate         # regenerate the Prisma client
npm run api seed             # demo account with two weeks of history
npm run api migrate:status   # what is applied and what is pending
npm run api studio           # browse the data
```

The seed creates `demo@pomodoro.app` / `demo1234` with projects, tasks and
enough session history for the dashboard and statistics screens to render
something meaningful.

Migrations live in `apps/api/prisma/migrations` and are applied in order:

| Migration                | Contents                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `init`                   | Tables, enums, primary and foreign keys, indexes generated from the Prisma schema                               |
| `add_domain_constraints` | Partial unique indexes, expression indexes and CHECK constraints that the Prisma schema language cannot express |

The second migration is where the domain invariants live. The one that matters
most:

```sql
CREATE UNIQUE INDEX "one_active_session_per_user"
    ON "pomodoro_sessions" ("user_id")
    WHERE "status" IN ('RUNNING', 'PAUSED');
```

The service checks for an active session before inserting, but two concurrent
requests can both pass that check. The index makes the loser of the race fail
with `23505`, which the API returns as `409 Conflict`. The rule holds even
against a direct `psql` session.

### Data model

| Entity            | Notes                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| `User`            | Credentials and the durations used when a session starts without an explicit one                  |
| `Project`         | Soft-archived, so focus time recorded against its tasks is never erased                           |
| `Task`            | Optionally belongs to a project; detached rather than deleted when the project goes               |
| `PomodoroSession` | Stores `started_at`, `duration_sec` and accumulated pause time — never a mutable "time remaining" |
| `RefreshToken`    | Only the hash is stored; supports per-device logout                                               |

`userId` is denormalised onto `Task` and `PomodoroSession` even though it is
reachable through `Project`. Every read is scoped to its owner with no join, so
a missing authorisation scope is visible in review rather than hidden behind a
relation.

### Backend

```bash
npm run api start:dev      # watch mode on http://localhost:3000/api/v1
```

| Endpoint                                                        | Purpose                                               |
| --------------------------------------------------------------- | ----------------------------------------------------- |
| `POST /api/v1/auth/register` `login` `refresh` `logout`         | Account and session lifecycle                         |
| `GET` `PATCH /api/v1/me`                                        | Profile and Pomodoro preferences                      |
| `GET` `POST /api/v1/projects` · `GET` `PATCH` `DELETE /:id`     | Projects; delete archives                             |
| `GET` `POST /api/v1/tasks` · `GET` `PATCH` `DELETE /:id`        | Tasks; filter by `projectId`, `status`                |
| `POST /api/v1/sessions/start`                                   | Start a session; 409 while one is active              |
| `GET /api/v1/sessions/active`                                   | The session to render; 204 when there is none         |
| `PATCH /api/v1/sessions/:id/pause` `resume` `complete` `cancel` | State transitions                                     |
| `GET /api/v1/sessions`                                          | Finished sessions, cursor-paginated                   |
| `GET /api/v1/stats/summary` `daily` `by-project`                | Productivity metrics, aggregated in SQL               |
| `GET /api/v1/health`                                            | Readiness probe, 503 when the database is unreachable |
| `GET /api/docs` `docs-json`                                     | Swagger UI and the OpenAPI document                   |

| Script                  | Purpose                         |
| ----------------------- | ------------------------------- |
| `npm run api start:dev` | Start the API in watch mode     |
| `npm run api build`     | Compile to `apps/api/dist`      |
| `npm run api lint`      | Lint the backend                |
| `npm run api typecheck` | Type-check without emitting     |
| `npm run api test`      | Run unit and integration suites |

Every route sits behind the `/api/v1` prefix. Requests are validated by a global
pipe with `whitelist` and `forbidNonWhitelisted` enabled, so a payload carrying
fields the DTO never declared is rejected rather than silently trimmed.

### Authentication

Authentication is **on by default**: a guard is registered globally and routes
opt out with `@Public()`. Forgetting a decorator leaves an endpoint closed
rather than open.

| Token   | Form                         | Lifetime | Notes                                                                                |
| ------- | ---------------------------- | -------- | ------------------------------------------------------------------------------------ |
| Access  | JWT, `Authorization: Bearer` | 15 min   | Stateless; carries the user id                                                       |
| Refresh | Opaque random bytes          | 30 days  | Only its SHA-256 hash is stored, so a database leak does not hand over live sessions |

Refresh tokens **rotate**: each use revokes the presented token and issues a new
one, inside a transaction so a crash cannot leave both valid.

Replaying a token already retired **by rotation** means it leaked, so every
session for that user ends. A token retired by an explicit **logout** is
different — a client retrying is not evidence of theft — so it is simply
rejected. The database records which of the two happened, and a CHECK constraint
keeps the reason and the revocation timestamp in step.

Passwords use scrypt from `node:crypto`. Login hashes a dummy value when the
email is unknown, so response time does not reveal which addresses are
registered.

Set `JWT_SECRET` to at least 32 characters — the API validates its configuration
at boot and refuses to start otherwise:

```bash
openssl rand -base64 48
```

### Pomodoro sessions

A session stores **when it began**, **how long it should last** and **how long it
has been paused**. It never stores a mutable "time remaining":

```
elapsed   = (now or pausedAt or endedAt) − startedAt − pausedAccumulatedMs
remaining = max(0, durationSec × 1000 − elapsed)
```

There is no state to synchronise, only a shared calculation over persisted
instants — which is why the three scenarios the brief asks about are correct by
construction rather than by reconciliation logic:

| Scenario                   | What happens                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| App closed and reopened    | `GET /sessions/active` returns the session; the client recomputes the countdown                    |
| Backend restarted          | Nothing was held in memory to lose                                                                 |
| Opened on another device   | Same query, same answer                                                                            |
| Deadline passed while away | The session is settled as `COMPLETED`, ended at the **deadline**, not at the moment it was noticed |

Every session payload carries `serverTime`. Clients measure the offset against
their own clock and apply it, so a device with the wrong time still counts down
correctly.

```
[*] ──▶ RUNNING ⇄ PAUSED ──▶ COMPLETED
             └──────┴───────▶ CANCELLED
```

An invalid transition answers **409** with the current status attached, so the
client reconciles instead of retrying blindly.

Three independent mechanisms keep "one session at a time" true:

1. `clientMutationId` makes a retried start after a dropped connection resolve
   to the same session instead of a second one.
2. The service refuses to start while another session is active.
3. The **partial unique index** refuses it again at the database — which is what
   holds when two devices race and both pass step 2.

### Metrics

Every figure is aggregated in SQL. No endpoint returns rows for the client to
sum: the client must not be able to disagree with the server about how much
focus time a user has, and pulling a year of sessions over the wire to add them
up would be wrong twice over.

Two decisions worth stating:

**Focused time is time actually run** — `endedAt − startedAt − pausedAccumulated`
— not the nominal `durationSec`. A session finished early counts for what it was
worth, and time spent paused is not counted as focus.

**Days belong to a time zone.** `?timeZone=America/Sao_Paulo` decides which
calendar day a session falls on; without it a 22:00 session would land on the
following day. The daily series fills empty days with zeros through
`generate_series`, so a chart has no holes.

The streak query groups days by the gap between the date and its row number,
which is constant inside a run of consecutive days — so "days in a row ending
today" is one grouped query rather than a loop over every day since sign-up. A
streak survives today being empty and counts up to yesterday.

### Ownership

Every query is scoped by the owner: `where: { id, userId }`, never `where: { id }`.
A resource belonging to someone else answers **404, not 403** — a 403 would
confirm the id exists.

Deletion is asymmetric on purpose. Archiving a project or deleting a task keeps
the Pomodoro sessions recorded against them; the foreign keys detach the history
rather than cascading it away. Focus time already spent is a fact, and tidying
up a board must not rewrite it.

## Running the whole stack

```bash
cp .env.example .env
# JWT_SECRET must be at least 32 characters
docker compose up -d --build
curl localhost:3000/api/v1/health
```

Brings up PostgreSQL and the API together, with migrations applied on start —
the fastest way to evaluate the project without a Node toolchain installed. Day
to day, `npm run api start:dev` on the host is better, because it watches.

The image is multi-stage: the build tree is discarded and the runtime carries
only compiled output plus production dependencies. `prisma` is a runtime
dependency rather than a development one, deliberately: migrations are applied
by the entrypoint when the container starts, and `migrate deploy` needs the CLI.

`migrate deploy` only applies migrations already committed to the repository —
it never generates one and never resets — so running it on every boot is safe
and idempotent when several instances start at once.

### Mobile app

```bash
npm run mobile start        # Metro, for a development build
npm run mobile lint
npm run mobile typecheck
npm run mobile test
```

The client is an Expo app using Expo Router for file-based navigation, React
Native Paper for the component layer, TanStack Query for server state and
Zustand for the little local state that is genuinely local.

Because the repository is an npm workspace, dependencies hoist to the root,
where Metro does not look by default. `metro.config.js` adds the root to
`watchFolders` and `nodeModulesPaths` and disables hierarchical lookup, so the
bundler cannot resolve a second copy of React from a parent directory. Without
it the app fails to bundle at all.

## Pointing the app at a backend

The API address is configuration, not a constant: the mobile client reads it
from a build-time variable and exposes it on the profile screen, so the same
build works against a machine on the local network, a colleague's host, or a
hosted instance.

To evaluate on a physical device, run the stack and point the app at the host
machine:

```bash
docker compose up -d --build
hostname -I | awk '{print $1}'   # e.g. 192.168.0.42
```

Then set the API base URL in the app to `http://192.168.0.42:3000/api/v1`, with
the device on the same network.

The brief asks for instructions to run the project and a clear way to evaluate
it, not for a hosted environment, so there is no deployment step to reproduce.
The image built here is a plain OCI container with no platform-specific
configuration: any host that runs containers will serve it, given `DATABASE_URL`
and `JWT_SECRET`.

## Contributing

Branches are short-lived and every change reaches `main` through a pull request.
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
with `<app>/<module>` scopes, validated by a `commit-msg` hook.

```bash
npm install        # installs workspace dependencies and git hooks
npm run format     # formats the repository
```

## License

MIT
