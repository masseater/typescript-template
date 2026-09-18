import { cva } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

const iconVariants = cva("shrink-0", {
  defaultVariants: { size: "medium", tone: "current" },
  variants: {
    size: { large: "size-8", medium: "size-5", small: "size-4" },
    tone: { current: "", primary: "text-primary" },
  },
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types
function Icon({
  icon: Glyph,
  size,
  tone,
}: Readonly<{
  icon: LucideIcon;
  size?: "large" | "medium" | "small";
  tone?: "current" | "primary";
}>): ReactElement {
  return <Glyph data-slot="icon" aria-hidden="true" className={iconVariants({ size, tone })} />;
}

export { Icon };
