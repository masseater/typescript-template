import type { ActionState } from "./action";
import type { SessionView } from "./protocol";

type Enrollment = {
  readonly totpURI: string;
  readonly backupCodes: readonly string[];
};

type PasskeySummary = {
  readonly id: string;
  readonly name?: string | null | undefined;
};

type SettingsContext = {
  readonly action: ActionState;
  readonly recovery: string | undefined;
  readonly session: SessionView;
  readonly onNotice: (notice: string) => void;
  readonly onNoticeClear: () => void;
};

export type { Enrollment, PasskeySummary, SettingsContext };
