import { NavigationLink } from "../shared/ui/navigation-link.tsx";
import { DestinationBadge } from "./destination-badge.tsx";
import { DestinationText } from "./destination-text.tsx";
import { accessibleLabel, rowClass } from "./utils.ts";

import type { ReactElement } from "react";
import type { AppFrameDestination } from "./types.ts";

const FrameDestination = ({
  collapsed,
  compact,
  destination,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  destination: Readonly<AppFrameDestination>;
}>): ReactElement => {
  const destinationLabel = accessibleLabel(destination);
  return (
    <li>
      <NavigationLink
        activeOptions={{ exact: destination.exact ?? true, includeSearch: false }}
        aria-label={destinationLabel}
        title={destinationLabel}
        to={destination.to}
        variant="side"
      >
        <span className={rowClass(collapsed, compact)}>
          <span className="relative">
            {destination.icon}
            {compact ? <DestinationBadge badge={destination.badge} compact /> : null}
          </span>
          <DestinationText collapsed={collapsed} compact={compact} destination={destination} />
          {!compact && !collapsed ? (
            <DestinationBadge badge={destination.badge} compact={false} />
          ) : null}
        </span>
      </NavigationLink>
    </li>
  );
};

export { FrameDestination };
