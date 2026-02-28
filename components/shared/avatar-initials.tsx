import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarInitialsProps {
  name: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

const PASTEL_COLORS = [
  'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function getColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PASTEL_COLORS.length;
}

export function AvatarInitials({ name, size = 'md', className }: AvatarInitialsProps) {
  const initials = getInitials(name);
  const colorClass = PASTEL_COLORS[getColorIndex(name)];

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn(colorClass, 'font-medium')}>{initials}</AvatarFallback>
    </Avatar>
  );
}
