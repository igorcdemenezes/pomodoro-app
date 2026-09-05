import { rangeStart } from './history-range';

describe('history range', () => {
  it('opens the window at local midnight, not at this hour minus seven days', () => {
    // Late in the evening a rolling 168-hour window would already exclude this
    // morning, which is not what a person asking for "the week" means.
    const now = new Date(2026, 8, 4, 23, 30);

    expect(rangeStart('week', now)).toBe(new Date(2026, 7, 29, 0, 0, 0, 0).toISOString());
  });

  it('counts the range inclusive of today', () => {
    const now = new Date(2026, 8, 4, 9, 0);

    expect(rangeStart('month', now)).toBe(new Date(2026, 7, 6, 0, 0, 0, 0).toISOString());
  });

  it('asks for no lower bound when the whole history is wanted', () => {
    expect(rangeStart('all', new Date(2026, 8, 4))).toBeUndefined();
  });
});
