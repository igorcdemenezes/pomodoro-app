-- Domain invariants enforced by the database.
--
-- Prisma's schema language cannot express partial indexes, expression indexes
-- or CHECK constraints, so they live here as plain SQL. The point is that these
-- rules survive a buggy service, a race between two devices, or a direct psql
-- session — the application is not the only thing standing between the data and
-- an inconsistent state.

-- ---------------------------------------------------------------------------
-- At most one active Pomodoro session per user.
--
-- The service checks this before inserting, but two concurrent start requests
-- can both pass that check. The partial unique index makes the second INSERT
-- fail with 23505, which the API translates into 409 Conflict.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "one_active_session_per_user"
    ON "pomodoro_sessions" ("user_id")
    WHERE "status" IN ('RUNNING', 'PAUSED');

-- ---------------------------------------------------------------------------
-- Session state consistency.
--
-- Each timestamp is tied to the status that justifies it, so a session cannot
-- be PAUSED without a pause instant, or COMPLETED without an end instant.
-- ---------------------------------------------------------------------------
ALTER TABLE "pomodoro_sessions"
    ADD CONSTRAINT "session_duration_positive"
        CHECK ("duration_sec" > 0),
    ADD CONSTRAINT "session_paused_accumulated_non_negative"
        CHECK ("paused_accumulated_ms" >= 0),
    ADD CONSTRAINT "session_paused_at_matches_status"
        CHECK (("status" = 'PAUSED') = ("paused_at" IS NOT NULL)),
    ADD CONSTRAINT "session_ended_at_matches_status"
        CHECK (("status" IN ('COMPLETED', 'CANCELLED')) = ("ended_at" IS NOT NULL)),
    ADD CONSTRAINT "session_ended_after_started"
        CHECK ("ended_at" IS NULL OR "ended_at" >= "started_at"),
    ADD CONSTRAINT "session_paused_after_started"
        CHECK ("paused_at" IS NULL OR "paused_at" >= "started_at");

-- ---------------------------------------------------------------------------
-- Project names are unique per user, case-insensitively, among active projects.
--
-- Archived projects are excluded: reusing the name of something you archived is
-- reasonable, colliding with something you can still see is not.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX "unique_active_project_name_per_user"
    ON "projects" ("user_id", lower("name"))
    WHERE "archived_at" IS NULL;

ALTER TABLE "projects"
    ADD CONSTRAINT "project_name_not_blank"
        CHECK (length(btrim("name")) > 0),
    ADD CONSTRAINT "project_color_is_hex"
        CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$');

-- ---------------------------------------------------------------------------
-- Task consistency.
-- ---------------------------------------------------------------------------
ALTER TABLE "tasks"
    ADD CONSTRAINT "task_title_not_blank"
        CHECK (length(btrim("title")) > 0),
    ADD CONSTRAINT "task_estimated_pomodoros_in_range"
        CHECK ("estimated_pomodoros" BETWEEN 0 AND 100),
    ADD CONSTRAINT "task_completed_at_matches_status"
        CHECK (("status" = 'DONE') = ("completed_at" IS NOT NULL));

-- ---------------------------------------------------------------------------
-- User preferences must describe a usable Pomodoro cycle.
-- ---------------------------------------------------------------------------
ALTER TABLE "users"
    ADD CONSTRAINT "user_email_lowercase"
        CHECK ("email" = lower("email")),
    ADD CONSTRAINT "user_focus_duration_in_range"
        CHECK ("focus_duration_sec" BETWEEN 60 AND 14400),
    ADD CONSTRAINT "user_short_break_in_range"
        CHECK ("short_break_sec" BETWEEN 60 AND 14400),
    ADD CONSTRAINT "user_long_break_in_range"
        CHECK ("long_break_sec" BETWEEN 60 AND 14400),
    ADD CONSTRAINT "user_cycles_until_long_break_in_range"
        CHECK ("cycles_until_long_break" BETWEEN 1 AND 12);

-- ---------------------------------------------------------------------------
-- Refresh tokens.
-- ---------------------------------------------------------------------------
ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_token_revoked_after_created"
        CHECK ("revoked_at" IS NULL OR "revoked_at" >= "created_at");

-- Lookup path used on every token rotation: the active tokens of one user.
CREATE INDEX "refresh_tokens_user_active_idx"
    ON "refresh_tokens" ("user_id", "expires_at")
    WHERE "revoked_at" IS NULL;
