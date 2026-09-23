import { getRouteApi } from "@tanstack/react-router";

import { RecordingPage } from "./recording-page.tsx";
import { RecordingsPage } from "./recordings-page.tsx";

import type { ReactElement } from "react";

const listRoute = getRouteApi("/_dashboard/recordings/");
const detailRoute = getRouteApi("/_dashboard/recordings/$id");

function RecordingsRoute(): ReactElement {
  return <RecordingsPage overview={listRoute.useLoaderData()} />;
}

function RecordingRoute(): ReactElement {
  return <RecordingPage recording={detailRoute.useLoaderData()} />;
}

export { RecordingRoute, RecordingsRoute };
