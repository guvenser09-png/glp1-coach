/**
 * Unit tests for src/utils/foodDatabase.js (Report E1).
 * Pure data module — no React Native / supabase imports.
 */
import { FOOD_DATABASE } from '../src/utils/foodDatabase';

describe('FOOD_DATABASE', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(FOOD_DATABASE)).toBe(true);
    expect(FOOD_DATABASE.length).toBeGreaterThan(0);
  });

  it('has entries with a name and numeric protein/calories', () => {
    FOOD_DATABASE.forEach((entry) => {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);

      expect(typeof entry.protein).toBe('number');
      expect(Number.isFinite(entry.protein)).toBe(true);
      expect(entry.protein).toBeGreaterThanOrEqual(0);

      expect(typeof entry.calories).toBe('number');
      expect(Number.isFinite(entry.calories)).toBe(true);
      expect(entry.calories).toBeGreaterThan(0);
    });
  });

  it('has a bilingual Turkish name on every entry', () => {
    FOOD_DATABASE.forEach((entry) => {
      expect(typeof entry.nameTr).toBe('string');
      expect(entry.nameTr.length).toBeGreaterThan(0);
    });
  });
});
