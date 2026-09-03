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
| Infrastructure | Docker Compose (local), Railway (hosted API)                 |

## Repository layout

| Path          | Contents                                                               |
| ------------- | ---------------------------------------------------------------------- |
| `apps/api`    | NestJS backend: HTTP API, business rules, Prisma schema and migrations |
| `apps/mobile` | Expo client                                                            |
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

| Endpoint             | Purpose                             |
| -------------------- | ----------------------------------- |
| `GET /api/v1/health` | Liveness probe                      |
| `GET /api/docs`      | Swagger UI, generated from the code |
| `GET /api/docs-json` | OpenAPI document                    |

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
