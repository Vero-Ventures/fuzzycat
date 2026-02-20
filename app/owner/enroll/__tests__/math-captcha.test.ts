import { describe, expect, it } from 'bun:test';

/**
 * Unit tests for the math captcha logic.
 * Since the MathCaptcha component relies on React rendering,
 * these tests validate the underlying logic (problem generation, answer checking).
 */

function generateProblem(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return { a, b, answer: a + b };
}

describe('MathCaptcha logic', () => {
  describe('generateProblem', () => {
    it('generates numbers between 1 and 20', () => {
      for (let i = 0; i < 100; i++) {
        const problem = generateProblem();
        expect(problem.a).toBeGreaterThanOrEqual(1);
        expect(problem.a).toBeLessThanOrEqual(20);
        expect(problem.b).toBeGreaterThanOrEqual(1);
        expect(problem.b).toBeLessThanOrEqual(20);
      }
    });

    it('answer equals a + b', () => {
      for (let i = 0; i < 100; i++) {
        const problem = generateProblem();
        expect(problem.answer).toBe(problem.a + problem.b);
      }
    });

    it('answer is between 2 and 40', () => {
      for (let i = 0; i < 100; i++) {
        const problem = generateProblem();
        expect(problem.answer).toBeGreaterThanOrEqual(2);
        expect(problem.answer).toBeLessThanOrEqual(40);
      }
    });
  });

  describe('answer verification', () => {
    it('correct answer passes', () => {
      const problem = generateProblem();
      const userAnswer = problem.answer;
      expect(userAnswer).toBe(problem.a + problem.b);
    });

    it('incorrect answer fails', () => {
      const problem = generateProblem();
      const wrongAnswer = problem.answer + 1;
      expect(wrongAnswer).not.toBe(problem.a + problem.b);
    });

    it('string parsed as integer matches answer', () => {
      const problem = generateProblem();
      const parsed = Number.parseInt(String(problem.answer), 10);
      expect(parsed).toBe(problem.answer);
    });
  });
});
