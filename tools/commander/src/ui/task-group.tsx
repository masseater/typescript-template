import type { ReactElement } from "react";

import type { Task } from "#contract.ts";
import { Heading } from "@repo/ui";

import { TaskRow } from "./task-row.tsx";

type TaskView = typeof Task.Type;
type Kind = "done" | "needsHuman" | "ready" | "running" | "waiting";

function note(task: TaskView, kind: Kind, titles: ReadonlyMap<string, string>): string {
  if (kind === "waiting") {
    const blockers = task.blockedBy.map((id) => titles.get(id) ?? id).join("、");
    return task.assignee === undefined ? `${blockers} 待ち` : `${blockers} 待ち・停止予定`;
  }
  if (kind === "running" && task.labels.includes("needs-review")) {
    return "レビュー待ち";
  }
  return kind === "done" ? (task.closeReason ?? "") : "";
}

function TaskGroup({
  kind,
  label,
  onSelect,
  selectedId,
  tasks,
  titles,
}: Readonly<{
  kind: Kind;
  label: string;
  onSelect: (id: string) => void;
  selectedId: string | undefined;
  tasks: readonly TaskView[];
  titles: ReadonlyMap<string, string>;
}>): ReactElement {
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <Heading as="h3" size="block">
        {label}（{tasks.length}）
      </Heading>
      <ul className="flex flex-col gap-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            note={note(task, kind, titles)}
            selected={task.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}

export { TaskGroup };
