/**
 * Unit tests for src/services/aiClient.ts (audit #9 — test coverage).
 * The supabaseClient module is mocked so no network / native code runs:
 * we control `supabase.functions.invoke` and `isSupabaseConfigured` directly.
 */

// Mock factory — referenced inside the module under test via the same import path.
jest.mock('../src/services/supabaseClient', () => ({
  isSupabaseConfigured: jest.fn(() => true),
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { callAIChat, isAIConfigured } from '../src/services/aiClient';
import { supabase, isSupabaseConfigured } from '../src/services/supabaseClient';

const invoke = supabase.functions.invoke;
const messages = [{ role: 'user', content: 'hi' }];

beforeEach(() => {
  jest.clearAllMocks();
  isSupabaseConfigured.mockReturnValue(true);
});

describe('callAIChat — success', () => {
  it('returns the trimmed content string on a successful invoke', async () => {
    invoke.mockResolvedValue({ data: { content: '  hello world  ' }, error: null });
    const result = await callAIChat({ messages });
    expect(result).toBe('hello world');
    expect(invoke).toHaveBeenCalledWith('ai-proxy', expect.objectContaining({
      body: expect.objectContaining({ messages }),
    }));
  });

  it('defaults to the cheap model when none is given', async () => {
    invoke.mockResolvedValue({ data: { content: 'ok' }, error: null });
    await callAIChat({ messages });
    expect(invoke).toHaveBeenCalledWith('ai-proxy', expect.objectContaining({
      body: expect.objectContaining({ model: 'gpt-4o-mini' }),
    }));
  });
});

describe('callAIChat — AI_UNAVAILABLE failures', () => {
  async function expectUnavailable(promise) {
    await expect(promise).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  }

  it('throws AI_UNAVAILABLE when invoke returns an error', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expectUnavailable(callAIChat({ messages }));
  });

  it('throws AI_UNAVAILABLE when data.error is set', async () => {
    invoke.mockResolvedValue({ data: { error: 'rate_limited', message: 'slow down' }, error: null });
    await expectUnavailable(callAIChat({ messages }));
  });

  it('throws AI_UNAVAILABLE when content is missing', async () => {
    invoke.mockResolvedValue({ data: {}, error: null });
    await expectUnavailable(callAIChat({ messages }));
  });

  it('throws AI_UNAVAILABLE when content is an empty string', async () => {
    invoke.mockResolvedValue({ data: { content: '' }, error: null });
    await expectUnavailable(callAIChat({ messages }));
  });

  it('throws AI_UNAVAILABLE when content is not a string', async () => {
    invoke.mockResolvedValue({ data: { content: 42 }, error: null });
    await expectUnavailable(callAIChat({ messages }));
  });

  it('throws AI_UNAVAILABLE when Supabase is not configured (no invoke)', async () => {
    isSupabaseConfigured.mockReturnValue(false);
    await expectUnavailable(callAIChat({ messages }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('throws AI_UNAVAILABLE when messages is an empty array', async () => {
    await expectUnavailable(callAIChat({ messages: [] }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('throws AI_UNAVAILABLE when messages is not an array', async () => {
    await expectUnavailable(callAIChat({ messages: 'nope' }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('retries once then throws AI_UNAVAILABLE on persistent failure', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'transient' } });
    await expectUnavailable(callAIChat({ messages }));
    // one initial try + one retry
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});

describe('isAIConfigured', () => {
  it('reflects isSupabaseConfigured() === true', () => {
    isSupabaseConfigured.mockReturnValue(true);
    expect(isAIConfigured()).toBe(true);
  });

  it('reflects isSupabaseConfigured() === false', () => {
    isSupabaseConfigured.mockReturnValue(false);
    expect(isAIConfigured()).toBe(false);
  });
});
