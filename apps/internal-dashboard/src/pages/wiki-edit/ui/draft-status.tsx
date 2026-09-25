import { ButtonAnchor, FailureStatus, STATUS_VARIANT, StatusMessage } from "@repo/ui";

import type { ReactElement } from "react";

type DraftStatusProps = Readonly<{
  failure: string | undefined;
  publishedUrl: string | null;
  version: number;
}>;

function DraftNotice({
  publishedUrl,
  version,
}: Omit<DraftStatusProps, "failure">): ReactElement | null {
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

function DraftStatus({ failure, publishedUrl, version }: DraftStatusProps): ReactElement {
  return (
    <>
      <DraftNotice publishedUrl={publishedUrl} version={version} />
      <FailureStatus error={failure} />
    </>
  );
}

export { DraftStatus };
