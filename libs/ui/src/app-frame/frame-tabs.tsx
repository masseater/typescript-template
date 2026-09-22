import { FrameTab } from "./frame-tab.tsx";

import type { ReactElement } from "react";
import type { AppFrameDestination } from "./types.ts";

const FrameTabs = ({
  destinations,
}: Readonly<{ destinations: readonly AppFrameDestination[] }>): ReactElement => {
  return (
    <nav
      aria-label="メイン"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-card md:hidden"
    >
      {destinations.map((destination) => (
        <FrameTab key={destination.to} destination={destination} />
      ))}
    </nav>
  );
};

export { FrameTabs };
