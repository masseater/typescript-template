import type { ReactElement } from "react";

const DestinationBadge = ({
  badge,
  compact,
}: Readonly<{ badge: number | undefined; compact: boolean }>): ReactElement | null => {
  if (badge === undefined || badge === 0) {
    return null;
  }
  if (compact) {
    return (
      <span className="absolute -top-1 -right-2 rounded-full bg-secondary px-1 text-sm leading-none font-bold text-secondary-foreground">
        {badge}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-sm leading-none font-bold text-secondary-foreground">
      {badge}
    </span>
  );
};

export { DestinationBadge };
