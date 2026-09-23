import type { ReactElement } from "react";

type AppFrameDestination = Readonly<{
  badge?: number;
  exact?: boolean;
  icon: ReactElement;
  label: string;
  marker?: string;
  to: string;
}>;

type AppFrameSection = Readonly<{
  destinations: readonly AppFrameDestination[];
  label: string;
}>;

export type { AppFrameDestination, AppFrameSection };
