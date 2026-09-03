## What

<!-- One paragraph: what capability this pull request adds or changes. -->

## Why

<!-- The problem or requirement behind it. Link the section of docs/PLANO.md it delivers. -->

## How

<!-- Notable implementation decisions and trade-offs. Call out anything a reviewer
     would otherwise have to reverse-engineer: transactions, constraints, migrations. -->

## How to verify

<!-- Concrete steps a reviewer can run.
     1. docker compose up -d
     2. npm run api dev
     3. curl ...
-->

## Checklist

- [ ] Commits follow Conventional Commits and are atomic
- [ ] Business rules live in the service layer, not in controllers
- [ ] Database migration included (if the schema changed)
- [ ] Tests cover the new behaviour
- [ ] No secrets, credentials or `.env` files committed
