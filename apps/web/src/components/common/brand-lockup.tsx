import { Logo } from './logo';

/** The logo tile with "NextGen Grader / KMUTNB" beside it, above the `/login` and `/setup` cards. */
export function BrandLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <p className="flex flex-col leading-tight">
        <strong className="text-lg font-extrabold tracking-tight">
          NextGen Grader
        </strong>
        <small className="text-muted-foreground text-xs font-semibold">
          KMUTNB
        </small>
      </p>
    </div>
  );
}
