function processRows(table: string): ReadonlyArray<readonly [number, number]> {
  return table.split("\n").flatMap((row) => {
    const [pidText, parentText] = row.trim().split(/\s+/u);
    const pid = Number(pidText);
    const parent = Number(parentText);
    return Number.isInteger(pid) && Number.isInteger(parent) && pid > 0
      ? [[parent, pid] as const]
      : [];
  });
}

function descendantPids(root: number, rows: ReadonlyArray<readonly [number, number]>): number[] {
  const children = new Map<number, number[]>();
  for (const [parent, pid] of rows) {
    const list = children.get(parent);
    if (list === undefined) {
      children.set(parent, [pid]);
    } else {
      list.push(pid);
    }
  }
  const found: number[] = [];
  const pending = [...(children.get(root) ?? [])];
  const seen = new Set<number>();
  while (pending.length > 0) {
    const pid = pending.pop();
    if (pid === undefined || seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    found.push(pid);
    pending.push(...(children.get(pid) ?? []));
  }
  return found;
}

function killQuietly(pid: number): void {
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}

export { descendantPids, killQuietly, processRows };
