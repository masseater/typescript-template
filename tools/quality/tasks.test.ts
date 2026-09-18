import { blockedByChanges, taskGraphViolations } from "./task-graph.ts";
import { describe, expect, it } from "vite-plus/test";
import { tasks } from "./tasks.ts";

const first = 1;
const second = 2;
const third = 3;
const unregistered = 9;

const graph = {
  first: { blockedBy: [], issue: first },
  second: { blockedBy: ["first"], issue: second },
  third: { blockedBy: ["first", "second"], issue: third },
};

describe("task graph", () => {
  it("keeps the registered tasks free of duplicate issues, shared branches and cycles", () => {
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

  it("reports a cycle from each of its members and not from the tasks that only lead into it", () => {
    expect.assertions(1);
    expect(
      taskGraphViolations({
        first: { blockedBy: ["second"], issue: first },
        second: { blockedBy: ["first"], issue: second },
        third: { blockedBy: ["first"], issue: third },
      }),
    ).toStrictEqual([
      "blockedBy が循環しています: first -> second -> first",
      "blockedBy が循環しています: second -> first -> second",
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
          [first, [unregistered]],
          [third, [second]],
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
          [second, [first]],
          [third, [second, first]],
        ]),
      ),
    ).toStrictEqual([]);
  });
});
