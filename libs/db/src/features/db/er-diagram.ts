import { Column, is } from "drizzle-orm";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";

const sameColumns = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((columnName) => right.includes(columnName));

type KeyedTable = {
  readonly columns: readonly Column[];
  readonly name: string;
  readonly primary: readonly string[];
  readonly references: readonly {
    readonly columns: readonly Column[];
    readonly parent: string;
  }[];
  readonly unique: readonly (readonly string[])[];
};

const entityBlock = ({
  columns,
  name,
  primary,
  references,
  unique,
}: KeyedTable): readonly string[] => {
  const referencing = references.flatMap((reference) =>
    reference.columns.map((column) => column.name),
  );
  const keysOf = (columnName: string): readonly string[] => [
    ...(primary.includes(columnName) ? ["PK"] : []),
    ...(referencing.includes(columnName) ? ["FK"] : []),
    ...(!primary.includes(columnName) &&
    unique.some((uniqueKey) => sameColumns(uniqueKey, [columnName]))
      ? ["UK"]
      : []),
  ];
  return [
    `  ${name} {`,
    ...columns.map((column) =>
      [
        `    ${column.getSQLType()} ${column.name}`,
        ...keysOf(column.name).map((keyMarker, position) =>
          position === 0 ? ` ${keyMarker}` : `, ${keyMarker}`,
        ),
        ...(column.notNull ? [] : [' "nullable"']),
      ].join(""),
    ),
    "  }",
  ];
};

const relationshipLines = ({ name, references, unique }: KeyedTable): readonly string[] =>
  references.map(({ columns, parent }) => {
    const referencing = columns.map((column) => column.name);
    const parentCardinality = columns.every((column) => column.notNull) ? "||" : "|o";
    const childCardinality = unique.some((uniqueKey) => sameColumns(uniqueKey, referencing))
      ? "o|"
      : "o{";
    return `  ${parent} ${parentCardinality}--${childCardinality} ${name} : "${referencing.join(", ")}"`;
  });

const columnNames = (columns: readonly Column[]): readonly string[] =>
  columns.map((column) => column.name);

const plainIndexKeys = (columns: readonly unknown[]): readonly (readonly string[])[] => {
  const plainColumns = columns.flatMap((column) => (is(column, Column) ? [column.name] : []));
  return plainColumns.length === columns.length ? [plainColumns] : [];
};

const erDiagram = <Table extends SQLiteTable>(tables: Readonly<Record<string, Table>>): string => {
  const keyedTables = Object.values(tables)
    .map((table): KeyedTable => {
      const config = getTableConfig(table);
      const primary = [
        ...config.columns.filter((column) => column.primary).map((column) => column.name),
        ...config.primaryKeys.flatMap((primaryKey) => columnNames(primaryKey.columns)),
      ];
      return {
        columns: config.columns,
        name: config.name,
        primary,
        references: config.foreignKeys.map((foreignKey) => {
          const { columns, foreignTable } = foreignKey.reference();
          return { columns, parent: getTableConfig(foreignTable).name };
        }),
        unique: [
          primary,
          ...config.columns.filter((column) => column.isUnique).map((column) => [column.name]),
          ...config.uniqueConstraints.map((constraint) => columnNames(constraint.columns)),
          ...config.indexes
            .filter((index) => index.config.unique && index.config.where === undefined)
            .flatMap((index) => plainIndexKeys(index.config.columns)),
        ],
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
  return [
    "erDiagram",
    ...keyedTables.flatMap((keyedTable) => entityBlock(keyedTable)),
    ...keyedTables.flatMap((keyedTable) => relationshipLines(keyedTable)),
  ].join("\n");
};

export { erDiagram };
