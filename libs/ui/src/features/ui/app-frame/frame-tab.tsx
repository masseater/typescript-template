import { NavigationLink } from "../shared/ui/navigation-link.tsx";
import { DestinationBadge } from "./destination-badge.tsx";
import { accessibleLabel } from "./utils.ts";

import type { ReactElement } from "react";
import type { AppFrameDestination } from "./types.ts";

const FrameTab = ({
  destination,
}: Readonly<{ destination: Readonly<AppFrameDestination> }>): ReactElement => {
  const destinationLabel = accessibleLabel(destination);
  return (
    <div className="flex-1">
      <NavigationLink
        activeOptions={{ exact: destination.exact ?? true, includeSearch: false }}
        aria-label={destinationLabel}
        title={destinationLabel}
        to={destination.to}
        variant="side"
      >
        <span className="flex flex-col items-center gap-1">
          <span className="relative">
            {destination.icon}
            <DestinationBadge badge={destination.badge} compact />
          </span>
          {destination.marker === undefined ? null : (
            <span className="text-sm leading-none font-bold text-muted-foreground">
              {destination.marker}
            </span>
          )}
        </span>
      </NavigationLink>
    </div>
  );
};

export { FrameTab };
