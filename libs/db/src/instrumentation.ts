import type {
  D1Database,
  D1DatabaseSession,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
} from "@cloudflare/workers-types";
import { observeStatement, unwrapStatements } from "./observed-statement.ts";
import type { DatabaseTrace } from "./database-trace.ts";
import { ObservedSession } from "./observed-session.ts";

class ObservedDatabase implements D1Database {
  private readonly original: D1Database;
  private readonly trace: DatabaseTrace;

  public constructor(original: D1Database, trace: DatabaseTrace) {
    this.original = original;
    this.trace = trace;
  }

  public prepare(query: string): D1PreparedStatement {
    return observeStatement(this.original.prepare(query), query, this.trace);
  }

  public async batch<Row = unknown>(
    statements: readonly D1PreparedStatement[],
  ): Promise<D1Result<Row>[]> {
    return this.trace("TRANSACTION", async () =>
      this.original.batch<Row>(unwrapStatements(statements)),
    );
  }

  public async exec(query: string): Promise<D1ExecResult> {
    return this.trace("OTHER", async () => this.original.exec(query));
  }

  public withSession(
    constraintOrBookmark?: Parameters<D1Database["withSession"]>[0],
  ): D1DatabaseSession {
    return new ObservedSession(this.original.withSession(constraintOrBookmark), this.trace);
  }

  public async dump(): Promise<ArrayBuffer> {
    return this.trace("OTHER", async () => {
      throw new Error("d1_dump_unsupported");
    });
  }
}

function instrumentD1(binding: D1Database, trace: DatabaseTrace): D1Database {
  return new ObservedDatabase(binding, trace);
}

export { instrumentD1 };
