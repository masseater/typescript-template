import type { D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import type { DatabaseOperation, DatabaseTrace } from "./database-trace.ts";

const keywordOperations = new Map<string, DatabaseOperation>([
  ["ALTER", "MIGRATE"],
  ["CREATE", "MIGRATE"],
  ["DELETE", "DELETE"],
  ["DROP", "MIGRATE"],
  ["INSERT", "INSERT"],
  ["SELECT", "SELECT"],
  ["UPDATE", "UPDATE"],
]);

function statementOperation(query: string): DatabaseOperation {
  const keyword = /^\s*(?<keyword>[a-z]+)\b/iu.exec(query)?.groups?.["keyword"]?.toUpperCase();
  return (keyword === undefined ? undefined : keywordOperations.get(keyword)) ?? "OTHER";
}

class ObservedStatement implements D1PreparedStatement {
  public readonly original: Readonly<D1PreparedStatement>;
  private readonly operation: DatabaseOperation;
  private readonly trace: DatabaseTrace;

  public constructor(
    original: Readonly<D1PreparedStatement>,
    operation: DatabaseOperation,
    trace: DatabaseTrace,
  ) {
    this.original = original;
    this.operation = operation;
    this.trace = trace;
  }

  public bind(...values: readonly unknown[]): D1PreparedStatement {
    return new ObservedStatement(this.original.bind(...values), this.operation, this.trace);
  }

  public async first<Row = Record<string, unknown>>(column?: string): Promise<Row | null> {
    return this.trace(this.operation, async () =>
      column === undefined ? this.original.first<Row>() : this.original.first<Row>(column),
    );
  }

  public async run<Row = Record<string, unknown>>(): Promise<D1Result<Row>> {
    return this.trace(this.operation, async () => this.original.run<Row>());
  }

  public async all<Row = Record<string, unknown>>(): Promise<D1Result<Row>> {
    return this.trace(this.operation, async () => this.original.all<Row>());
  }

  public raw<Row = unknown[]>(
    options: Readonly<{ columnNames: true }>,
  ): Promise<[string[], ...Row[]]>;
  public raw<Row = unknown[]>(options?: Readonly<{ columnNames?: false }>): Promise<Row[]>;
  public async raw<Row = unknown[]>(
    options?: Readonly<{ columnNames?: boolean }>,
  ): Promise<Row[] | [string[], ...Row[]]> {
    return options?.columnNames === true
      ? this.trace(this.operation, async () => this.original.raw<Row>({ columnNames: true }))
      : this.trace(this.operation, async () => this.original.raw<Row>());
  }
}

function unwrapStatement(statement: Readonly<D1PreparedStatement>): D1PreparedStatement {
  return statement instanceof ObservedStatement ? unwrapStatement(statement.original) : statement;
}

function observeStatement(
  statement: Readonly<D1PreparedStatement>,
  query: string,
  trace: DatabaseTrace,
): D1PreparedStatement {
  return new ObservedStatement(statement, statementOperation(query), trace);
}

function unwrapStatements(
  statements: readonly Readonly<D1PreparedStatement>[],
): D1PreparedStatement[] {
  return statements.map((statement) => unwrapStatement(statement));
}

export { observeStatement, unwrapStatements };
