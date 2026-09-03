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
