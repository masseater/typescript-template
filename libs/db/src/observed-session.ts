import type {
  D1DatabaseSession,
  D1PreparedStatement,
  D1Result,
  D1SessionBookmark,
} from "@cloudflare/workers-types";
import { observeStatement, unwrapStatements } from "./observed-statement.ts";
import type { DatabaseTrace } from "./database-trace.ts";

class ObservedSession implements D1DatabaseSession {
  private readonly original: Readonly<D1DatabaseSession>;
  private readonly trace: DatabaseTrace;

  public constructor(original: Readonly<D1DatabaseSession>, trace: DatabaseTrace) {
    this.original = original;
    this.trace = trace;
  }

  public prepare(query: string): D1PreparedStatement {
    return observeStatement(this.original.prepare(query), query, this.trace);
  }

  public async batch<Row = unknown>(
    statements: readonly Readonly<D1PreparedStatement>[],
  ): Promise<D1Result<Row>[]> {
    return this.trace("TRANSACTION", async () =>
      this.original.batch<Row>(unwrapStatements(statements)),
    );
  }

  public getBookmark(): D1SessionBookmark | null {
    return this.original.getBookmark();
  }
}

export { ObservedSession };
