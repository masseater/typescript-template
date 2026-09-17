import type { D1Database, D1DatabaseSession, D1PreparedStatement } from "@cloudflare/workers-types";

export type DatabaseOperation =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "MIGRATE"
  | "TRANSACTION"
  | "OTHER";

export type DatabaseTrace = <T>(
  operation: DatabaseOperation,
  execute: () => Promise<T>,
) => Promise<T>;

function statementOperation(query: string): DatabaseOperation {
  const keyword = /^\s*([a-z]+)\b/i.exec(query)?.[1]?.toUpperCase();
  switch (keyword) {
    case "SELECT":
    case "INSERT":
    case "UPDATE":
    case "DELETE":
      return keyword;
    case "CREATE":
    case "ALTER":
    case "DROP":
      return "MIGRATE";
    default:
      return "OTHER";
  }
}

class ObservedStatement implements D1PreparedStatement {
  readonly original: D1PreparedStatement;
  private readonly operation: DatabaseOperation;
  private readonly trace: DatabaseTrace;

  constructor(original: D1PreparedStatement, operation: DatabaseOperation, trace: DatabaseTrace) {
    this.original = original;
    this.operation = operation;
    this.trace = trace;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new ObservedStatement(this.original.bind(...values), this.operation, this.trace);
  }

  first<T = unknown>(column: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    return this.trace(this.operation, () =>
      column === undefined ? this.original.first<T>() : this.original.first<T>(column),
    );
  }

  run<T = Record<string, unknown>>() {
    return this.trace(this.operation, () => this.original.run<T>());
  }

  all<T = Record<string, unknown>>() {
    return this.trace(this.operation, () => this.original.all<T>());
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    return options?.columnNames === true
      ? this.trace(this.operation, () => this.original.raw<T>({ columnNames: true }))
      : this.trace(this.operation, () => this.original.raw<T>());
  }
}

function unwrap(statement: D1PreparedStatement): D1PreparedStatement {
  return statement instanceof ObservedStatement ? unwrap(statement.original) : statement;
}

class ObservedSession implements D1DatabaseSession {
  private readonly original: D1DatabaseSession;
  private readonly trace: DatabaseTrace;

  constructor(original: D1DatabaseSession, trace: DatabaseTrace) {
    this.original = original;
    this.trace = trace;
  }

  prepare(query: string): D1PreparedStatement {
    return new ObservedStatement(
      this.original.prepare(query),
      statementOperation(query),
      this.trace,
    );
  }

  batch<T = unknown>(statements: D1PreparedStatement[]) {
    return this.trace("TRANSACTION", () => this.original.batch<T>(statements.map(unwrap)));
  }

  getBookmark() {
    return this.original.getBookmark();
  }
}

class ObservedDatabase implements D1Database {
  private readonly original: D1Database;
  private readonly trace: DatabaseTrace;

  constructor(original: D1Database, trace: DatabaseTrace) {
    this.original = original;
    this.trace = trace;
  }

  prepare(query: string): D1PreparedStatement {
    return new ObservedStatement(
      this.original.prepare(query),
      statementOperation(query),
      this.trace,
    );
  }

  batch<T = unknown>(statements: D1PreparedStatement[]) {
    return this.trace("TRANSACTION", () => this.original.batch<T>(statements.map(unwrap)));
  }

  exec(query: string) {
    return this.trace("OTHER", () => this.original.exec(query));
  }

  withSession(constraintOrBookmark?: Parameters<D1Database["withSession"]>[0]): D1DatabaseSession {
    return new ObservedSession(this.original.withSession(constraintOrBookmark), this.trace);
  }

  dump() {
    return this.trace("OTHER", () => this.original.dump());
  }
}

export function instrumentD1(binding: D1Database, trace: DatabaseTrace): D1Database {
  return new ObservedDatabase(binding, trace);
}
