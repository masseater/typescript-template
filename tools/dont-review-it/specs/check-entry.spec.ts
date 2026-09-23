import { runCommand } from "citty";
import { describe, expect, it } from "vite-plus/test";

import { dontReviewItCommand } from "../src/features/dont-review-it/dont-review-it-command.ts";
import { EXIT_MISUSE } from "../src/features/dont-review-it/repository-checks/index.ts";

describe("リポジトリ検査の入口", () => {
  it("check 以外の命令を名指しで拒否する", async () => {
    await expect(runCommand(dontReviewItCommand, { rawArgs: ["deploy"] })).rejects.toThrow(
      /Unknown command/u,
    );
  });

  it("存在しない場所を検査対象に取らない", async () => {
    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", "/nonexistent/verified-specifications-probe"],
    });

    expect(process.exitCode).toBe(EXIT_MISUSE);
    process.exitCode = 0;
  });
});
