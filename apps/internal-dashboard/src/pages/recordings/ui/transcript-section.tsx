import { Heading } from "@repo/ui";

import { clockOf, speakerName } from "#pages/recordings/model/recording-labels.ts";

import type { RecordingDetail } from "#pages/recordings/model/recording-state.ts";
import type { ReactElement } from "react";

function TranscriptSection({ recording }: Readonly<{ recording: RecordingDetail }>): ReactElement {
  return (
    <section aria-labelledby="transcript-heading" className="flex flex-col gap-4">
      <Heading as="h2" size="section">
        <span id="transcript-heading">書き起こし</span>
      </Heading>
      <ol className="flex flex-col gap-3">
        {recording.segments.map((segment) => (
          <li
            key={`${String(segment.startMs)}-${String(segment.speakerLabel)}`}
            className="flex flex-col gap-1"
          >
            <span className="text-sm text-muted-foreground">
              {clockOf(segment.startMs)} {speakerName(segment.speakerLabel, recording.speakers)}
            </span>
            <span className="text-base leading-normal">{segment.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export { TranscriptSection };
