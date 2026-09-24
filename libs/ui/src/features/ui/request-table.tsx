import { LoadingRow } from "./loading-row";
import { resultError } from "./request";
import { settledValue, type ListedValue } from "./request-value";
import { RetryableFailure } from "./retryable-failure";
import { Table } from "./shared/ui/table";
import { TableBody } from "./shared/ui/table-body";
import { TableHead } from "./shared/ui/table-head";
import { TableHeader } from "./shared/ui/table-header";
import { TableRow } from "./shared/ui/table-row";

import type { ReactElement } from "react";

const RequestTable = <Listing extends object>({
  columns,
  listing,
  onReload,
  row,
}: Readonly<{
  columns: readonly string[];
  listing: Listing;
  onReload: () => void;
  row: (listed: ListedValue<Listing>) => ReactElement;
}>): ReactElement => {
  const failure = resultError(listing);
  if (failure !== undefined) {
    return (
      <RetryableFailure onRetry={onReload}>
        {"一覧を取得できませんでした。"}
        {failure}
      </RetryableFailure>
    );
  }
  const loaded = settledValue(listing) as readonly ListedValue<Listing>[] | undefined;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loaded === undefined ? (
          <LoadingRow columnCount={columns.length} />
        ) : (
          loaded.map((listed) => row(listed))
        )}
      </TableBody>
    </Table>
  );
};

export { RequestTable };
