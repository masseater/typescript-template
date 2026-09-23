import { FrameDestination } from "./frame-destination.tsx";
import { sectionKey } from "./utils.ts";

import type { ReactElement } from "react";
import type { AppFrameSection } from "./types.ts";

const FrameNavigation = ({
  collapsed,
  compact,
  navigationId,
  sections,
}: Readonly<{
  collapsed: boolean;
  compact: boolean;
  navigationId: string;
  sections: readonly AppFrameSection[];
}>): ReactElement => {
  return (
    <nav
      aria-label="メイン"
      className={
        compact
          ? "flex flex-1 flex-col gap-1 overflow-y-auto p-1"
          : "flex flex-1 flex-col overflow-y-auto"
      }
      id={navigationId}
    >
      <div className={compact ? "flex flex-1 flex-col gap-1" : "flex flex-1 flex-col gap-4 p-2"}>
        {sections.map((section) => (
          <div key={sectionKey(section)} className="flex flex-col gap-1">
            {collapsed || compact || section.label === "" ? null : (
              <p className="px-3 text-sm leading-tight font-bold text-muted-foreground">
                {section.label}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {section.destinations.map((destination) => (
                <FrameDestination
                  key={destination.to}
                  collapsed={collapsed}
                  compact={compact}
                  destination={destination}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};

export { FrameNavigation };
