import { cn } from '@repo/ui/lib/utils';
import { CheckIcon, CircleIcon, XIcon } from 'lucide-react';

/**
 * The rules under a form input, each with its state: a grey circle until it
 * is met, a green check once it is, and a red cross when it is not met and the
 * field shows its errors. The state is also given as text for screen readers.
 * Link it from the input with `aria-describedby={id}`.
 */
export function RuleChecklist({
  id,
  rules,
  isShowingErrors,
}: {
  /** The list's id, for the input's `aria-describedby`. */
  id: string;
  /** Each rule's text and whether the current value meets it. */
  rules: readonly { label: string; isMet: boolean }[];
  /** Whether the field shows its errors now (see the form pattern in the frontend rules). */
  isShowingErrors: boolean;
}) {
  return (
    <ul id={id} className="flex flex-col gap-1">
      {rules.map(({ label, isMet }) => {
        const state = getRuleState(isMet, isShowingErrors);
        const Icon = RULE_ICONS[state];
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2 text-[13px] leading-4.5',
              RULE_COLORS[state],
            )}
          >
            <Icon
              aria-hidden
              strokeWidth={2.25}
              className="size-3.5 shrink-0"
            />
            {label}
            {state !== 'idle' && (
              <span className="sr-only">{RULE_STATE_TEXT[state]}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** How one rule looks: not judged yet, met, or failed. */
type RuleState = 'idle' | 'met' | 'failed';

const RULE_ICONS = {
  idle: CircleIcon,
  met: CheckIcon,
  failed: XIcon,
} as const;

const RULE_COLORS: Readonly<Record<RuleState, string>> = {
  idle: 'text-muted-foreground',
  met: 'text-success',
  failed: 'text-destructive',
};

/** Read after the rule's text, so the state is not given by color and icon alone. */
const RULE_STATE_TEXT: Readonly<Record<Exclude<RuleState, 'idle'>, string>> = {
  met: '(met)',
  failed: '(not met)',
};

/** Met shows at once; not met only once the field shows its errors, never while the User first types. */
function getRuleState(isMet: boolean, isShowingErrors: boolean): RuleState {
  if (isMet) return 'met';
  return isShowingErrors ? 'failed' : 'idle';
}
