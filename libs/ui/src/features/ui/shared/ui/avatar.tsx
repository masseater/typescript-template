import { cva } from "class-variance-authority";

import type { ReactElement } from "react";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold text-secondary-foreground select-none",
  {
    defaultVariants: { size: "medium" },
    variants: {
      size: { large: "size-20 text-2xl", medium: "size-12 text-lg", small: "size-8 text-sm" },
    },
  },
);

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

const initial = (displayName: string): string => {
  const [first] = graphemes.segment(displayName.trim());
  return first?.segment.toUpperCase() ?? "";
};

const Avatar = ({
  name,
  size,
  src,
}: Readonly<{
  name: string;
  size?: "large" | "medium" | "small";
  src?: string | undefined;
}>): ReactElement => {
  if (src === undefined) {
    return (
      <span data-slot="avatar" aria-hidden="true" className={avatarVariants({ size })}>
        {initial(name)}
      </span>
    );
  }
  return (
    <img
      data-slot="avatar"
      alt=""
      className={`${avatarVariants({ size })} object-cover`}
      decoding="async"
      src={src}
    />
  );
};

export { Avatar };
