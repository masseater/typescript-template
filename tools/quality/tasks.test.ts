import { blockedByChanges, issueViolations, taskGraphViolations } from "./task-graph.ts";
import { describe, expect, it } from "vite-plus/test";
import type { Tasks } from "./task-graph.ts";
import { tasks } from "./tasks.ts";

const first = 1;
const second = 2;
const third = 3;
const unregistered = 9;
const layers = 30;
const width = 3;

const graph = {
  first: { blockedBy: [], issue: first },
  second: { blockedBy: ["first"], issue: second },
  third: { blockedBy: ["first", "second"], issue: third },
};

function layered(): Tasks<string> {
  const keys = Array.from({ length: layers }, (_layer, layer) =>
    Array.from({ length: width }, (_slot, slot) => `task-${layer}-${slot}`),
  );
  return Object.fromEntries(
    keys.flatMap((layer, index) =>
      layer.map((key, slot) => [
        key,
        { blockedBy: keys[index + 1] ?? [], issue: index * width + slot },
      ]),
    ),
  );
}

describe("task graph", () => {
  it("keeps the registered tasks free of duplicates, unknown blockers and cycles", () => {
    expect.assertions(1);
    expect(taskGraphViolations(tasks)).toStrictEqual([]);
  });

  it("reports an issue assigned to two tasks", () => {
    expect.assertions(1);
    expect(
      taskGraphViolations({
        first: { blockedBy: [], issue: first },
        second: { blockedBy: [], issue: first },
      }),
    ).toStrictEqual(["Issue #1 が複数のタスクに割り当てられています"]);
  });

  it("reports a branch shared by two tasks", () => {
    expect.assertions(1);
    expect(
      taskGraphViolations({
        first: { blockedBy: [], branch: "feat/shared", issue: first },
        second: { blockedBy: [], branch: "feat/shared", issue: second },
      }),
    ).toStrictEqual(["branch feat/shared が複数のタスクに割り当てられています"]);
  });

  it("reports a blocker that is not registered", () => {
    expect.assertions(1);
    expect(taskGraphViolations({ first: { blockedBy: ["missing"], issue: first } })).toStrictEqual([
      "first の blockedBy にある missing は登録されていません",
    ]);
  });
});

describe("task graph cycles", () => {
  it("reports a cycle once and ignores the tasks that only lead into it", () => {
    expect.assertions(1);
    expect(
      taskGraphViolations({
        first: { blockedBy: ["second"], issue: first },
        second: { blockedBy: ["first"], issue: second },
        third: { blockedBy: ["first"], issue: third },
      }),
    ).toStrictEqual(["blockedBy が循環しています: first -> second -> first"]);
  });

  it("reports a task blocked by itself", () => {
    expect.assertions(1);
    expect(taskGraphViolations({ first: { blockedBy: ["first"], issue: first } })).toStrictEqual([
      "blockedBy が循環しています: first -> first",
    ]);
  });

  it("visits each task once in a graph whose paths grow exponentially", () => {
    expect.assertions(1);
    expect(taskGraphViolations(layered())).toStrictEqual([]);
  });
});

describe("registered issues", () => {
  it("reports an issue GitHub does not list and an issue that is already closed", () => {
    expect.assertions(1);
    expect(
      issueViolations(
        graph,
        new Map([
          [first, { blockedBy: [], closed: true }],
          [second, { blockedBy: [], closed: false }],
        ]),
      ),
    ).toStrictEqual([
      "first の Issue #1 は closed です。tasks.ts からこのタスクを消してください",
      "third の Issue #3 が GitHub にありません",
    ]);
  });
});

describe("blocked by synchronization", () => {
  it("adds the missing relations and removes the ones the registry no longer declares", () => {
    expect.assertions(1);
    expect(
      blockedByChanges(
        graph,
        new Map([
          [first, { blockedBy: [unregistered], closed: false }],
          [second, { blockedBy: [], closed: false }],
          [third, { blockedBy: [second], closed: false }],
        ]),
      ),
    ).toStrictEqual([
      { add: [], issue: first, remove: [unregistered] },
      { add: [first], issue: second, remove: [] },
      { add: [first], issue: third, remove: [] },
    ]);
  });

  it("changes nothing when GitHub already matches the registry", () => {
    expect.assertions(1);
    expect(
      blockedByChanges(
        graph,
        new Map([
          [first, { blockedBy: [], closed: false }],
          [second, { blockedBy: [first], closed: false }],
          [third, { blockedBy: [second, first], closed: false }],
        ]),
      ),
    ).toStrictEqual([]);
  });
});
