import { ButtonAnchor, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

type DraftStatusProps = Readonly<{
  failures: readonly (string | undefined)[];
  publishedUrl: string | null;
  version: number;
}>;

function DraftNotice({
  publishedUrl,
  version,
}: Omit<DraftStatusProps, "failures">): ReactElement | null {
  if (publishedUrl !== null) {
    return (
      <StatusMessage variant={STATUS_VARIANT.success}>
        <span className="flex flex-wrap items-center gap-2">
          公開の PR
          を作りました。マージされてデプロイされるとページに反映され、この下書きは消えます。
          <ButtonAnchor href={publishedUrl} variant="secondary">
            PR を開く
          </ButtonAnchor>
        </span>
      </StatusMessage>
    );
  }
  return version === 0 ? null : (
    <StatusMessage variant={STATUS_VARIANT.info}>
      下書きとして保存されています。公開されたページはまだ変わっていません。
    </StatusMessage>
  );
}

function DraftStatus({ failures, publishedUrl, version }: DraftStatusProps): ReactElement {
  return (
    <>
      <DraftNotice publishedUrl={publishedUrl} version={version} />
      {failures
        .filter((failure) => failure !== undefined)
        .map((failure) => (
          <StatusMessage key={failure} variant={STATUS_VARIANT.failure}>
            {failure}
          </StatusMessage>
        ))}
    </>
  );
}

export { DraftStatus };
