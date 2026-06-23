/**
 * Unit tests for src/services/firestoreService.js (audit #9 — test coverage).
 * supabaseClient is mocked so no network / native code runs. We build a small
 * chainable query-builder stub so `.from().select().eq()...` resolves to data
 * we control, and assert the two contracts that matter most:
 *   (a) write functions THROW when Supabase returns { error }  (audit #7 guard)
 *   (b) read functions scope by user_id and parse rows to camelCase
 */

jest.mock('../src/services/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import {
  saveWeightLog,
  saveUserProfile,
  getWeightLogs,
  getUserProfile,
} from '../src/services/firestoreService';
import { supabase, isSupabaseConfigured } from '../src/services/supabaseClient';

const UID = 'user-123';

// Build a query-builder mock. Chainable methods (.eq/.order/.select) return the
// builder; terminal awaits resolve to `result`. `.maybeSingle()` also resolves.
function makeBuilder(result) {
  const builder = {};
  for (const m of ['select', 'eq', 'order', 'insert', 'upsert', 'update', 'delete']) {
    builder[m] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn(() => Promise.resolve(result));
  builder.single = jest.fn(() => Promise.resolve(result));
  // Make the builder itself awaitable (for chains with no .single()/.maybeSingle()).
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(true);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: UID } }, error: null });
});

describe('write functions surface Supabase errors (audit #7 regression guard)', () => {
  it('saveWeightLog THROWS when upsert returns { error }', async () => {
    supabase.from.mockReturnValue(makeBuilder({ error: { message: 'rls denied' } }));
    await expect(saveWeightLog(UID, 82)).rejects.toThrow('rls denied');
  });

  it('saveUserProfile THROWS when upsert returns { error }', async () => {
    supabase.from.mockReturnValue(makeBuilder({ error: { message: 'constraint' } }));
    await expect(saveUserProfile(UID, { name: 'A' })).rejects.toThrow('constraint');
  });

  it('saveWeightLog resolves with the new entry on success', async () => {
    supabase.from.mockReturnValue(makeBuilder({ error: null }));
    const result = await saveWeightLog(UID, 82);
    expect(result).toMatchObject({ weight: 82 });
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('saveWeightLog upserts with the resolved user_id', async () => {
    const builder = makeBuilder({ error: null });
    supabase.from.mockReturnValue(builder);
    await saveWeightLog(UID, 82);
    expect(supabase.from).toHaveBeenCalledWith('weight_logs');
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: UID, weight: 82 }),
      expect.objectContaining({ onConflict: 'user_id,date' })
    );
  });
});

describe('read functions filter by user_id and parse rows', () => {
  it('getWeightLogs applies an .eq("user_id", uid) filter and maps rows', async () => {
    const builder = makeBuilder({
      data: [
        { date: '2026-01-01', weight: 80, extra: 'ignored' },
        { date: '2026-01-08', weight: 79 },
      ],
      error: null,
    });
    supabase.from.mockReturnValue(builder);

    const rows = await getWeightLogs(UID);
    expect(supabase.from).toHaveBeenCalledWith('weight_logs');
    expect(builder.eq).toHaveBeenCalledWith('user_id', UID);
    expect(rows).toEqual([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 79 },
    ]);
  });

  it('getWeightLogs returns [] when Supabase returns an error', async () => {
    supabase.from.mockReturnValue(makeBuilder({ data: null, error: { message: 'x' } }));
    expect(await getWeightLogs(UID)).toEqual([]);
  });

  it('getUserProfile filters by user_id and maps snake_case to camelCase', async () => {
    const builder = makeBuilder({
      data: { name: 'Jo', goal_weight: 70, protein_target: 120, weight: 80 },
      error: null,
    });
    supabase.from.mockReturnValue(builder);

    const profile = await getUserProfile(UID);
    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(builder.eq).toHaveBeenCalledWith('user_id', UID);
    expect(profile).toMatchObject({ name: 'Jo', goalWeight: 70, proteinTarget: 120, weight: 80 });
  });

  it('read functions short-circuit to safe values when Supabase is not configured', async () => {
    isSupabaseConfigured.mockReturnValue(false);
    expect(await getWeightLogs(UID)).toEqual([]);
    expect(await getUserProfile(UID)).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
