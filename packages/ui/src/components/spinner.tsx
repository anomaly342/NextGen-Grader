import { cn } from 'cn';
import { Loader2Icon } from 'lucide-react';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cn(
        // Reduced motion slows the spin rather than stopping it, so it still reads as busy.
        'size-4 animate-spin motion-reduce:[animation-duration:6s]',
        className,
      )}
      {...props}
    />
  );
}

export { Spinner };
