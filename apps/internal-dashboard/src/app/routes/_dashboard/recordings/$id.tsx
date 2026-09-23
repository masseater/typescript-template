import { createFileRoute } from "@tanstack/react-router";

import { RecordingRoute, loadRecording } from "#pages/recordings/index.ts";

const Route = createFileRoute("/_dashboard/recordings/$id")({
  component: RecordingRoute,
  loader: ({ params }: Readonly<{ params: Readonly<{ id: string }> }>) => loadRecording(params.id),
});

export { Route };
