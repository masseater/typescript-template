import { useNavigate, useRouter } from "@tanstack/react-router";

import { useRecordingActions } from "#pages/recordings/model/recording-actions.ts";
import { RecordingView } from "./recording-view.tsx";

import type { RecordingDetail } from "#pages/recordings/model/recording-state.ts";
import type { ReactElement } from "react";

function RecordingPage({ recording }: Readonly<{ recording: RecordingDetail }>): ReactElement {
  const router = useRouter();
  const navigate = useNavigate();
  const actions = useRecordingActions(recording.recording.id, {
    onChanged: () => router.invalidate(),
    onDeleted: () => navigate({ to: "/recordings" }),
  });
  return (
    <RecordingView actions={actions} onRefresh={() => router.invalidate()} recording={recording} />
  );
}

export { RecordingPage };
