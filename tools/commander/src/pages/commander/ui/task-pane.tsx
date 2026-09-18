import type { ReactElement } from "react";
import { useState } from "react";

import type { Snapshot } from "#shared/contract/index.ts";
import { Heading, Status } from "@repo/ui";

import { TaskDetail } from "./task-detail.tsx";
import { TaskGroup } from "./task-group.tsx";

type Tasks = typeof Snapshot.Type;

const groups: readonly (readonly [keyof Tasks, string])[] = [
  ["needsHuman", "要判断"],
  ["review", "レビュー待ち"],
  ["running", "実行中"],
  ["waiting", "待ち"],
  ["ready", "準備OK"],
  ["done", "完了"],
];

function TaskPane({ tasks }: Readonly<{ tasks: Tasks }>): ReactElement {
  const [selectedId, setSelectedId] = useState<string>();
  const all = groups.flatMap(([kind]) => tasks[kind]);
  const titles = new Map(all.map((task) => [task.id, task.title]));
  const selected = all.find((task) => task.id === selectedId);
  const shown = groups.filter(([kind]) => tasks[kind].length > 0);
  return (
    <section aria-label="タスク" className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <Heading as="h2" size="page">
        タスク
      </Heading>
      {all.length === 0 ? <Status>タスクはまだありません。</Status> : undefined}
      {shown.map(([kind, label]) => (
        <TaskGroup
          key={kind}
          kind={kind}
          label={label}
          tasks={tasks[kind]}
          titles={titles}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      ))}
      {selected === undefined ? undefined : <TaskDetail key={selected.id} task={selected} />}
    </section>
  );
}

export { TaskPane };
