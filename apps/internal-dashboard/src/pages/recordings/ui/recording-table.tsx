import {
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TextLink,
  formatWarekiDateTime,
} from "@repo/ui";

import { clockOf, statusLabels } from "#pages/recordings/model/recording-labels.ts";

import type { RecordingsOverview } from "#pages/recordings/api/recordings.ts";
import type { ReactElement } from "react";

function RecordingTable({
  recordings,
}: Readonly<{ recordings: RecordingsOverview["recordings"] }>): ReactElement {
  return (
    <section aria-labelledby="recordings-heading" className="flex flex-col gap-4">
      <Heading as="h2" size="section">
        <span id="recordings-heading">録音の一覧</span>
      </Heading>
      {recordings.length === 0 ? (
        <StatusMessage variant={STATUS_VARIANT.empty}>録音はまだありません。</StatusMessage>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>題</TableHead>
              <TableHead>状態</TableHead>
              <TableHead>長さ</TableHead>
              <TableHead>アップロードした人</TableHead>
              <TableHead>日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordings.map((recording) => (
              <TableRow key={recording.id}>
                <TableCell>
                  <TextLink to="/recordings/$id" params={{ id: recording.id }}>
                    {recording.title}
                  </TextLink>
                </TableCell>
                <TableCell>{statusLabels[recording.status]}</TableCell>
                <TableCell>
                  {recording.durationMs === null ? "—" : clockOf(recording.durationMs)}
                </TableCell>
                <TableCell>{recording.ownerName ?? "—"}</TableCell>
                <TableCell>{formatWarekiDateTime(recording.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

export { RecordingTable };
