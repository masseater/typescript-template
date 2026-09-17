const controlClassName =
  "box-border w-full rounded-md border border-input bg-card px-1 py-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground read-only:bg-muted focus-visible:focus-indicator disabled:pointer-events-none disabled:border-border/50 disabled:bg-card-hover disabled:text-disabled-foreground data-invalid:border-destructive";

const labelClassName =
  "inline-flex w-fit items-center gap-1 text-base leading-tight font-bold text-foreground select-none";

const fieldClassName = "flex w-full flex-col gap-1";

const errorClassName = "text-sm leading-normal text-destructive";

export { controlClassName, errorClassName, fieldClassName, labelClassName };
