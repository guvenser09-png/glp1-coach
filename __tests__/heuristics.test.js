/**
 * Unit tests for src/utils/heuristics.js (Report E1).
 * Pure module — no React Native / supabase imports, so it runs under
 * jest-expo without native mocking.
 */
import {
  detectRebound,
  calculateMuscleScore,
  calculateReboundRisk,
} from '../src/utils/heuristics';

describe('detectRebound', () => {
  it('returns the documented default shape for empty/invalid input', () => {
    expect(detectRebound([])).toEqual({
      trend: 'flat',
      gainedKg: 0,
      weeksTracked: 0,
      alert: 'none',
    });
    expect(detectRebound(null)).toEqual({
      trend: 'flat',
      gainedKg: 0,
      weeksTracked: 0,
      alert: 'none',
    });
    expect(detectRebound(undefined)).toEqual({
      trend: 'flat',
      gainedKg: 0,
      weeksTracked: 0,
      alert: 'none',
    });
  });

  it('returns flat with no alert for a single data point', () => {
    const result = detectRebound([{ date: '2026-01-01', weight: 80 }]);
    expect(result.trend).toBe('flat');
    expect(result.gainedKg).toBe(0);
    expect(result.alert).toBe('none');
  });

  it('detects an upward (rebound) trend', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 81 },
      { date: '2026-01-15', weight: 82 },
    ]);
    expect(result.trend).toBe('up');
  });

  it('detects a downward (weight loss) trend', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 90 },
      { date: '2026-01-08', weight: 88 },
      { date: '2026-01-15', weight: 86 },
    ]);
    expect(result.trend).toBe('down');
  });

  it('detects a flat trend when net change is within +/-0.3 kg', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 80.1 },
      { date: '2026-01-15', weight: 80.2 },
    ]);
    expect(result.trend).toBe('flat');
  });

  it('flags a "watch" alert when gain from the recent minimum is >= 1 kg', () => {
    // Drops to 78 then climbs to 79.5 -> gained 1.5 from the low point.
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 78 },
      { date: '2026-01-15', weight: 79.5 },
    ]);
    expect(result.gainedKg).toBeCloseTo(1.5, 5);
    expect(result.alert).toBe('watch');
  });

  it('flags a "high" alert when gain from the recent minimum is >= 2.5 kg', () => {
    // Drops to 78 then climbs to 81 -> gained 3 from the low point.
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 78 },
      { date: '2026-01-15', weight: 81 },
    ]);
    expect(result.gainedKg).toBeCloseTo(3, 5);
    expect(result.alert).toBe('high');
  });

  it('reports no alert and never-negative gain while still losing weight', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 90 },
      { date: '2026-01-08', weight: 88 },
      { date: '2026-01-15', weight: 86 },
    ]);
    expect(result.alert).toBe('none');
    expect(result.gainedKg).toBe(0);
    expect(result.gainedKg).toBeGreaterThanOrEqual(0);
  });

  it('computes weeksTracked from the date span', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-15', weight: 80 },
    ]);
    // 14 days = 2.0 weeks
    expect(result.weeksTracked).toBeCloseTo(2, 5);
  });

  it('ignores non-numeric weight entries without throwing', () => {
    const result = detectRebound([
      { date: '2026-01-01', weight: 80 },
      { date: '2026-01-08', weight: 'oops' },
      { date: '2026-01-15', weight: 82 },
    ]);
    expect(result.trend).toBe('up');
  });
});

describe('calculateMuscleScore', () => {
  it('returns 0 when the protein target is missing or non-positive', () => {
    expect(calculateMuscleScore(100, 0, 4)).toBe(0);
    expect(calculateMuscleScore(100, -10, 4)).toBe(0);
  });

  it('returns 100 when protein is met and exercise is optimal (4+ days)', () => {
    expect(calculateMuscleScore(120, 120, 4)).toBe(100);
    expect(calculateMuscleScore(200, 120, 7)).toBe(100);
  });

  it('caps the protein contribution at 70 when intake exceeds target', () => {
    // Over-target protein, zero exercise -> protein component only.
    expect(calculateMuscleScore(240, 120, 0)).toBe(70);
  });

  it('caps the exercise contribution at 30 with zero protein', () => {
    expect(calculateMuscleScore(0, 120, 4)).toBe(30);
    expect(calculateMuscleScore(0, 120, 7)).toBe(30);
  });

  it('computes a blended score for partial protein and exercise', () => {
    // 50% protein -> 35, 2/4 exercise -> 15 => 50
    expect(calculateMuscleScore(60, 120, 2)).toBe(50);
  });

  it('always returns an integer within 0..100', () => {
    const score = calculateMuscleScore(73, 120, 3);
    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateReboundRisk', () => {
  it('returns the documented shape', () => {
    const result = calculateReboundRisk(0.5, 1, 4, 0);
    expect(result).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        level: expect.any(String),
        factors: expect.any(Array),
      })
    );
  });

  it('reports Low risk for an ideal week', () => {
    const result = calculateReboundRisk(0.5, 1, 4, 0);
    expect(result.score).toBe(0);
    expect(result.level).toBe('Low');
    expect(result.factors).toEqual([]);
  });

  it('reports High risk for rapid loss + critically low protein + no exercise', () => {
    // 35 (loss >2%) + 30 (protein <60%) + 20 (no exercise) = 85
    const result = calculateReboundRisk(3, 0.4, 0, 0);
    expect(result.score).toBe(85);
    expect(result.level).toBe('High');
    expect(result.factors.length).toBeGreaterThanOrEqual(3);
  });

  it('clamps the score at 100', () => {
    const result = calculateReboundRisk(5, 0.1, 0, 7);
    expect(result.score).toBe(100);
    expect(result.level).toBe('High');
  });

  it('reports Medium risk in the 30..64 band', () => {
    // 15 (loss >1%) + 15 (protein <80%) + 10 (exercise <2) = 40
    const result = calculateReboundRisk(1.5, 0.7, 1, 0);
    expect(result.score).toBe(40);
    expect(result.level).toBe('Medium');
  });

  it('keeps the score within 0..100 across the level thresholds', () => {
    const result = calculateReboundRisk(1.5, 0.7, 1, 0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['Low', 'Medium', 'High']).toContain(result.level);
  });
});
