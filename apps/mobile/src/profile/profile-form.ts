import type { UserProfile } from '../auth/auth-types';
import type { UpdateProfileInput } from './profile-api';

/**
 * The editable profile, held as text.
 *
 * Durations are minutes here and seconds on the wire: nobody sets a focus block
 * in seconds, and a field that has to be cleared to be retyped cannot hold a
 * number mid-edit anyway.
 */
export interface ProfileDraft {
  name: string;
  focusMinutes: string;
  shortBreakMinutes: string;
  longBreakMinutes: string;
  cycles: string;
}

export type DraftField = keyof ProfileDraft;

/** Mirrors the bounds on `UpdateProfileDto`, in the unit the field is edited in. */
export const BOUNDS = {
  nameLength: { min: 2, max: 120 },
  minutes: { min: 1, max: 240 },
  cycles: { min: 1, max: 12 },
} as const;

const MINUTE_FIELDS = {
  focusMinutes: 'focusDurationSec',
  shortBreakMinutes: 'shortBreakSec',
  longBreakMinutes: 'longBreakSec',
} as const;

export function draftFrom(profile: UserProfile): ProfileDraft {
  return {
    name: profile.name,
    focusMinutes: minutes(profile.focusDurationSec),
    shortBreakMinutes: minutes(profile.shortBreakSec),
    longBreakMinutes: minutes(profile.longBreakSec),
    cycles: `${profile.cyclesUntilLongBreak}`,
  };
}

export function validate(draft: ProfileDraft): Partial<Record<DraftField, string>> {
  const errors: Partial<Record<DraftField, string>> = {};
  const name = draft.name.trim();

  if (name.length < BOUNDS.nameLength.min || name.length > BOUNDS.nameLength.max) {
    errors.name = `Between ${BOUNDS.nameLength.min} and ${BOUNDS.nameLength.max} characters.`;
  }

  for (const field of Object.keys(MINUTE_FIELDS) as (keyof typeof MINUTE_FIELDS)[]) {
    if (!withinBounds(draft[field], BOUNDS.minutes)) {
      errors[field] = `Between ${BOUNDS.minutes.min} and ${BOUNDS.minutes.max} minutes.`;
    }
  }

  if (!withinBounds(draft.cycles, BOUNDS.cycles)) {
    errors.cycles = `Between ${BOUNDS.cycles.min} and ${BOUNDS.cycles.max} sessions.`;
  }

  return errors;
}

/**
 * The fields the user actually edited, ready for a PATCH.
 *
 * Compared against the draft the screen opened with rather than against the
 * profile's own numbers: a duration the app cannot express in whole minutes
 * would otherwise look edited the moment the screen loaded, and saving the name
 * would quietly round the timer.
 */
export function changes(profile: UserProfile, draft: ProfileDraft): UpdateProfileInput {
  const initial = draftFrom(profile);
  const input: UpdateProfileInput = {};

  if (draft.name.trim() !== initial.name) input.name = draft.name.trim();

  for (const [field, key] of Object.entries(MINUTE_FIELDS) as [
    keyof typeof MINUTE_FIELDS,
    (typeof MINUTE_FIELDS)[keyof typeof MINUTE_FIELDS],
  ][]) {
    if (draft[field] !== initial[field]) input[key] = Number(draft[field]) * 60;
  }

  if (draft.cycles !== initial.cycles) input.cyclesUntilLongBreak = Number(draft.cycles);

  return input;
}

function withinBounds(value: string, bounds: { min: number; max: number }): boolean {
  const parsed = Number(value);

  return (
    /^\d+$/.test(value.trim()) &&
    Number.isInteger(parsed) &&
    parsed >= bounds.min &&
    parsed <= bounds.max
  );
}

function minutes(seconds: number): string {
  return `${Math.round(seconds / 60)}`;
}
