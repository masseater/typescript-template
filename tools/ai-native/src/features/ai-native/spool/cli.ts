#!/usr/bin/env node
import { runSpool } from "./run-spool.ts";

process.exitCode = await runSpool(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
