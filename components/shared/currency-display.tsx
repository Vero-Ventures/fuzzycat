import { cn } from '@/lib/utils';
import { formatCents } from '@/lib/utils/money';

interface CurrencyDisplayProps {
  amountCents: number;
  className?: string;
  showSign?: boolean;
}

export function CurrencyDisplay({
  amountCents,
  className,
  showSign = false,
}: CurrencyDisplayProps) {
  const formatted = formatCents(Math.abs(amountCents));
  let display = formatted;

  if (showSign) {
    if (amountCents > 0) {
      display = `+${formatted}`;
    } else if (amountCents < 0) {
      display = `-${formatted}`;
    }
  }

  return <span className={cn('tabular-nums', className)}>{display}</span>;
}
