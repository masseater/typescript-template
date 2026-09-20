import {
  NavigationLink,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  formatWarekiDate,
} from "@repo/ui";

import { agreementKindLabels, stateLabel } from "#pages/terms/model/agreement-labels.ts";

import type { VersionList } from "#pages/terms/model/agreement-versions.ts";
import type { ReactElement } from "react";

function AgreementVersionTable({
  versions,
}: Readonly<{ versions: VersionList["versions"] }>): ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>種類</TableHead>
          <TableHead>版</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>公開日</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {versions.map((version) => (
          <TableRow key={version.id}>
            <TableCell>{agreementKindLabels[version.kind]}</TableCell>
            <TableCell>
              <NavigationLink
                params={{ version: version.version }}
                to="/terms/$version"
                variant="item"
              >
                {version.version}
              </NavigationLink>
            </TableCell>
            <TableCell>{stateLabel(version.publishedAt)}</TableCell>
            <TableCell>
              {version.publishedAt === null ? "—" : formatWarekiDate(new Date(version.publishedAt))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export { AgreementVersionTable };
