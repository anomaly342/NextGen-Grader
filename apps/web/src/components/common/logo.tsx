import { cn } from '@repo/ui/lib/utils';
import { CodeIcon } from 'lucide-react';

/** The NextGen Grader logo tile: `<>` on brand blue. Decorative; put the product name beside it. */
export function Logo({ className }: { className?: string }) {
  return (
    <CodeIcon
      aria-hidden
      strokeWidth={2.25}
      className={cn(
        'bg-primary text-primary-foreground size-8 shrink-0 rounded-lg p-1.5',
        className,
      )}
    />
  );
}
