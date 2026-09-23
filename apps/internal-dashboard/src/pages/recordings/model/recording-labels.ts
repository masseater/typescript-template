import { RECORDING_STATUS } from "@repo/config";

import type { RecordingStatus } from "@repo/config";

const statusLabels: Readonly<Record<RecordingStatus, string>> = {
  [RECORDING_STATUS.done]: "完了",
  [RECORDING_STATUS.failed]: "失敗",
  [RECORDING_STATUS.queued]: "順番待ち",
  [RECORDING_STATUS.transcribing]: "文字起こし中",
};

const secondsPerMinute = 60;
const millisecondsPerSecond = 1000;
const clockDigits = 2;

function clockOf(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / millisecondsPerSecond);
  const minutes = Math.floor(seconds / secondsPerMinute);
  return `${String(minutes)}:${String(seconds % secondsPerMinute).padStart(clockDigits, "0")}`;
}

function speakerName(
  label: number,
  speakers: readonly Readonly<{ label: number; person: Readonly<{ name: string }> | null }>[],
): string {
  const assigned = speakers.find((speaker) => speaker.label === label)?.person;
  return assigned?.name ?? `話者 ${String(label + 1)}`;
}

export { clockOf, speakerName, statusLabels };
