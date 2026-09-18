import { cva } from "class-variance-authority";

import type { ReactElement } from "react";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground select-none",
  {
    defaultVariants: { size: "medium" },
    variants: {
      size: { large: "size-20 text-2xl", medium: "size-12 text-lg", small: "size-8 text-sm" },
    },
  },
);

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

function initial(name: string): string {
  const [first] = graphemes.segment(name.trim());
  return first?.segment.toUpperCase() ?? "";
}

function Avatar({
  name,
  size,
}: Readonly<{ name: string; size?: "large" | "medium" | "small" }>): ReactElement {
  return (
    <span data-slot="avatar" aria-hidden="true" className={avatarVariants({ size })}>
      {initial(name)}
    </span>
  );
}

export { Avatar };
