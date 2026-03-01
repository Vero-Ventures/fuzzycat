'use client';

import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface MathCaptchaProps {
  onVerified: (verified: boolean) => void;
}

export function generateProblem(): { a: number; b: number; answer: number } {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  return { a, b, answer: a + b };
}

export function MathCaptcha({ onVerified }: MathCaptchaProps) {
  const [problem, setProblem] = useState(() => generateProblem());
  const [userAnswer, setUserAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState(false);

  const handleRefresh = useCallback(() => {
    setProblem(generateProblem());
    setUserAnswer('');
    setVerified(false);
    setError(false);
    onVerified(false);
  }, [onVerified]);

  function handleCheck() {
    const parsed = Number.parseInt(userAnswer, 10);
    if (parsed === problem.answer) {
      setVerified(true);
      setError(false);
      onVerified(true);
    } else {
      setError(true);
      setVerified(false);
      onVerified(false);
    }
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Verification passed</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        Quick verification: What is {problem.a} + {problem.b}?
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Your answer"
          value={userAnswer}
          onChange={(e) => {
            setUserAnswer(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCheck();
            }
          }}
          className="w-32"
          aria-label="CAPTCHA answer"
        />
        <Button type="button" variant="outline" size="sm" onClick={handleCheck}>
          Verify
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title="New question"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-destructive">
          Incorrect answer. Please try again.
        </p>
      )}
    </div>
  );
}
