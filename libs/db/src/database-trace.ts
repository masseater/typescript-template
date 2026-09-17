type DatabaseOperation =
  | "SELECT"
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "MIGRATE"
  | "TRANSACTION"
  | "OTHER";

type DatabaseTrace = <Result>(
  operation: DatabaseOperation,
  execute: () => Promise<Result>,
) => Promise<Result>;

export type { DatabaseOperation, DatabaseTrace };
