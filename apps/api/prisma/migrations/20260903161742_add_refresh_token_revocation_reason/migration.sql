-- CreateEnum
CREATE TYPE "RefreshTokenRevokedReason" AS ENUM ('ROTATED', 'LOGOUT', 'REUSE_DETECTED');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "revoked_reason" "RefreshTokenRevokedReason";

-- A revoked token must always say why it was revoked, and a live token must
-- never carry a reason. Reuse detection reads this column to tell a replayed
-- rotated token (evidence of theft) from a token retired by an explicit logout
-- (a client retrying), so the two must not be conflatable.
ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_token_reason_matches_revocation"
        CHECK (("revoked_at" IS NULL) = ("revoked_reason" IS NULL));
