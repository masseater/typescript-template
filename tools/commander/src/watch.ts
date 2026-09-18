import { Effect, Ref } from "effect";

import type { Snapshot } from "./contract.ts";

type Tasks = typeof Snapshot.Type;

interface Attention {
  readonly human: readonly string[];
  readonly ready: readonly string[];
  readonly review: readonly string[];
}

const reviewing = "reviewing";
const workerLimit = 3;

function attention(tasks: Tasks): Attention {
  return {
    human: tasks.needsHuman.map((task) => task.id),
    ready: tasks.running.length < workerLimit ? tasks.ready.map((task) => task.id) : [],
    review: tasks.review.filter((task) => !task.labels.includes(reviewing)).map((task) => task.id),
  };
}

function briefing(tasks: Tasks | undefined): string {
  if (tasks === undefined) {
    return "";
  }
  const { human, ready, review } = attention(tasks);
  const parts = [
    review.length === 0 ? "" : `レビュー待ち ${review.join("、")}`,
    human.length === 0 ? "" : `ユーザーの判断待ち ${human.join("、")}`,
    ready.length === 0 ? "" : `ワーカーに空きがあるのに未着手 ${ready.join("、")}`,
  ].filter((part) => part !== "");
  return parts.length === 0
    ? ""
    : `（アプリが見ている台帳の現況: ${parts.join("／")}。「最初にやること」の 1〜6 で先に片付ける）`;
}

function keys({ human, ready, review }: Attention): readonly string[] {
  return [
    ...human.map((id) => `human:${id}`),
    ...ready.map((id) => `ready:${id}`),
    ...review.map((id) => `review:${id}`),
  ];
}

const wakePrompt =
  "（アプリの見張りからの呼び出し。ユーザーの発言ではない）台帳に司令塔の対応が要るものが出た。「最初にやること」の 1〜6 を実行し、結果とユーザーの判断が要ることだけを短く報告する。";

const makeWatch = Effect.fn("makeWatch")(function* makeWatch(
  wake: (text: string) => Effect.Effect<boolean>,
) {
  const handled = yield* Ref.make<ReadonlySet<string>>(new Set());
  return Effect.fn("watch")(function* watch(tasks: Tasks | undefined) {
    if (tasks === undefined) {
      return;
    }
    const present = keys(attention(tasks));
    const known = yield* Ref.get(handled);
    const kept = new Set(present.filter((key) => known.has(key)));
    yield* Ref.set(handled, kept);
    if (kept.size < present.length && (yield* wake(wakePrompt))) {
      yield* Ref.set(handled, new Set(present));
    }
  });
});

export { briefing, makeWatch };
