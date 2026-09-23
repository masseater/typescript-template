import { getTableConfig, type SQLiteColumn, type SQLiteTable } from "drizzle-orm/sqlite-core";

type TableConfig = ReturnType<typeof getTableConfig>;

const columnNames = (columns: readonly SQLiteColumn[]): readonly string[] =>
  columns.map((column) => column.name);

const sameColumns = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((name) => right.includes(name));

const primaryKeyColumns = (config: TableConfig): readonly string[] => [
  ...config.columns.filter((column) => column.primary).map((column) => column.name),
  ...config.primaryKeys.flatMap((primaryKey) => columnNames(primaryKey.columns)),
];

const uniqueKeys = (config: TableConfig): readonly (readonly string[])[] => [
  primaryKeyColumns(config),
  ...config.columns.filter((column) => column.isUnique).map((column) => [column.name]),
  ...config.uniqueConstraints.map((constraint) => columnNames(constraint.columns)),
  ...config.indexes.flatMap(({ config: { columns, unique, where } }) => {
    const plainColumns = columns.flatMap((column) => ("name" in column ? [column.name] : []));
    return unique && where === undefined && plainColumns.length === columns.length
      ? [plainColumns]
      : [];
  }),
];

const entityBlock = (config: TableConfig): readonly string[] => {
  const primary = primaryKeyColumns(config);
  const unique = uniqueKeys(config);
  const referencing = config.foreignKeys.flatMap((foreignKey) =>
    columnNames(foreignKey.reference().columns),
  );
  const keysOf = (name: string): readonly string[] => [
    ...(primary.includes(name) ? ["PK"] : []),
    ...(referencing.includes(name) ? ["FK"] : []),
    ...(!primary.includes(name) && unique.some((key) => sameColumns(key, [name])) ? ["UK"] : []),
  ];
  return [
    `  ${config.name} {`,
    ...config.columns.map((column) =>
      [
        `    ${column.getSQLType()} ${column.name}`,
        ...keysOf(column.name).map((key, position) => (position === 0 ? ` ${key}` : `, ${key}`)),
        ...(column.notNull ? [] : [' "nullable"']),
      ].join(""),
    ),
    "  }",
  ];
};

const relationshipLines = (config: TableConfig): readonly string[] => {
  const unique = uniqueKeys(config);
  return config.foreignKeys.map((foreignKey) => {
    const { columns, foreignTable } = foreignKey.reference();
    const referencing = columnNames(columns);
    const parent = columns.every((column) => column.notNull) ? "||" : "|o";
    const child = unique.some((key) => sameColumns(key, referencing)) ? "o|" : "o{";
    return `  ${getTableConfig(foreignTable).name} ${parent}--${child} ${config.name} : "${referencing.join(", ")}"`;
  });
};

const erDiagram = (tables: Readonly<Record<string, SQLiteTable>>): string => {
  const configs = Object.values(tables)
    .map((table) => getTableConfig(table))
    .toSorted((left, right) => left.name.localeCompare(right.name));
  return [
    "erDiagram",
    ...configs.flatMap((config) => entityBlock(config)),
    ...configs.flatMap((config) => relationshipLines(config)),
  ].join("\n");
};

export { erDiagram };
