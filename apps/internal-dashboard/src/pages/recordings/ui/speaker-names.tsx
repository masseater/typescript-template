import { Heading, SelectField } from "@repo/ui";

import type { RecordingDetail } from "#pages/recordings/model/recording-state.ts";
import type { ReactElement } from "react";

const unassigned = "";

function SpeakerNames({
  disabled,
  onAssign,
  recording,
}: Readonly<{
  disabled: boolean;
  onAssign: (label: number, personId: string | null) => void;
  recording: RecordingDetail;
}>): ReactElement {
  const options = [
    { label: "名前を付けない", value: unassigned },
    ...recording.people.map((person) => ({ label: person.name, value: person.id })),
  ];
  return (
    <section
      aria-labelledby="speakers-heading"
      aria-busy={disabled}
      className="flex flex-col gap-4"
    >
      <Heading as="h2" size="section">
        <span id="speakers-heading">話者</span>
      </Heading>
      <p className="text-base leading-normal text-muted-foreground">
        声で分けた話者ごとに、登録した人の名前を付けます。
      </p>
      {recording.speakers.map((speaker) => (
        <SelectField
          key={speaker.label}
          label={`話者 ${String(speaker.label + 1)}`}
          name={`speaker-${String(speaker.label)}`}
          options={options}
          value={speaker.person?.id ?? unassigned}
          onValueChange={(personId) => {
            onAssign(speaker.label, personId === unassigned ? null : personId);
          }}
        />
      ))}
    </section>
  );
}

export { SpeakerNames };
