-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cycle_reset_at" TIMESTAMPTZ(3);

-- The run of focus sessions before a long break is counted, not stored. This
-- instant is one more boundary for that count — beside the last long break and
-- local midnight — so a user who lost track of the run can start it over
-- without a session being touched or a statistic being lost.
