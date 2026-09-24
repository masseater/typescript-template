import { recordingFailures, recordingStatuses } from "@repo/config";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { user } from "./identity-schema.ts";

const speakerPerson = sqliteTable("speaker_person", {
  consentRecordedBy: text("consent_recorded_by").references(() => user.id, {
    onDelete: "set null",
  }),
  consentedAt: integer("consented_at", { mode: "timestamp_ms" }).notNull(),
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
});

const recording = sqliteTable(
  "recording",
  {
    byteSize: integer("byte_size").notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    contentType: text("content_type").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    durationMs: integer("duration_ms"),
    failure: text("failure", { enum: recordingFailures }),
    id: text("id").primaryKey().notNull(),
    jobId: text("job_id").notNull(),
    objectKey: text("object_key").notNull(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: recordingStatuses }).notNull(),
    title: text("title").notNull(),
  },
  (table) => [
    index("recording_created_at_idx").on(table.createdAt, table.id),
    uniqueIndex("recording_job_id_unique").on(table.jobId),
  ],
);

const recordingSpeaker = sqliteTable(
  "recording_speaker",
  {
    label: integer("label").notNull(),
    personId: text("person_id").references(() => speakerPerson.id, { onDelete: "set null" }),
    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.recordingId, table.label] })],
);

const recordingSegment = sqliteTable(
  "recording_segment",
  {
    endMs: integer("end_ms").notNull(),
    position: integer("position").notNull(),
    recordingId: text("recording_id")
      .notNull()
      .references(() => recording.id, { onDelete: "cascade" }),
    speakerLabel: integer("speaker_label").notNull(),
    startMs: integer("start_ms").notNull(),
    text: text("text").notNull(),
  },
  (table) => [primaryKey({ columns: [table.recordingId, table.position] })],
);

export { recording, recordingSegment, recordingSpeaker, speakerPerson };
