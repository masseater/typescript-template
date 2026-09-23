import type { ReactElement } from "react";
import type { AppFrameDestination } from "./types.ts";

const DestinationText = ({
  collapsed,
  compact,
  destination,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  destination: Readonly<AppFrameDestination>;
}>): ReactElement | null => {
  if (collapsed) {
    return null;
  }
  if (compact) {
    return (
      <span className="flex items-center justify-center gap-1 text-sm leading-none">
        <span>{destination.label}</span>
        {destination.marker === undefined ? null : (
          <span className="font-bold text-muted-foreground">{destination.marker}</span>
        )}
      </span>
    );
  }
  return <span className="min-w-0 flex-1 truncate">{destination.label}</span>;
};

export { DestinationText };
