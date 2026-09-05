import type { UserProfile } from '../auth/auth-types';
import { changes, draftFrom, validate } from './profile-form';

const PROFILE: UserProfile = {
  id: 'u1000000-0000-4000-8000-000000000001',
  email: 'demo@pomodoro.app',
  name: 'Demo',
  focusDurationSec: 1500,
  shortBreakSec: 300,
  longBreakSec: 900,
  cyclesUntilLongBreak: 4,
  createdAt: '2026-09-01T09:00:00.000Z',
};

describe('profile form', () => {
  it('opens with the durations in the unit they are edited in', () => {
    expect(draftFrom(PROFILE)).toEqual({
      name: 'Demo',
      focusMinutes: '25',
      shortBreakMinutes: '5',
      longBreakMinutes: '15',
      cycles: '4',
    });
  });

  it('sends only what was edited', () => {
    const draft = { ...draftFrom(PROFILE), focusMinutes: '50' };

    expect(changes(PROFILE, draft)).toEqual({ focusDurationSec: 3000 });
  });

  it('sends nothing when the draft is the profile', () => {
    expect(changes(PROFILE, draftFrom(PROFILE))).toEqual({});
  });

  it('does not rewrite a duration the form cannot express, when it was not touched', () => {
    // 90s is not a whole number of minutes. Editing the name must not round the
    // timer to 2 minutes as a side effect.
    const odd = { ...PROFILE, focusDurationSec: 90 };
    const draft = { ...draftFrom(odd), name: 'Ada' };

    expect(changes(odd, draft)).toEqual({ name: 'Ada' });
  });

  it('rejects what the API would reject, before asking it', () => {
    const draft = {
      ...draftFrom(PROFILE),
      name: 'A',
      focusMinutes: '0',
      shortBreakMinutes: '2.5',
      cycles: '13',
    };

    const errors = validate(draft);

    expect(errors.name).toBeDefined();
    expect(errors.focusMinutes).toBeDefined();
    expect(errors.shortBreakMinutes).toBeDefined();
    expect(errors.cycles).toBeDefined();
    expect(errors.longBreakMinutes).toBeUndefined();
  });

  it('trims the name it compares and the name it sends', () => {
    const draft = { ...draftFrom(PROFILE), name: '  Ada Lovelace  ' };

    expect(changes(PROFILE, draft)).toEqual({ name: 'Ada Lovelace' });
    expect(validate({ ...draft, name: '   ' }).name).toBeDefined();
  });
});
