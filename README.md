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

Schema and migrations arrive with the backend, under `apps/api/prisma`.

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
