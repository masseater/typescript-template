import { AGREEMENT_KIND } from "@repo/config";
import {
  Button,
  Heading,
  Page,
  StatusMessage,
  TextLink,
  formatWarekiDate,
  useAction,
} from "@repo/ui";
import { useRouter } from "@tanstack/react-router";
import { DateTime } from "effect";

import {
  PendingAgreementList,
  agreementKindLabels,
  withdrawAgreement,
} from "#entities/agreement/index.ts";

import type { Agreements } from "#entities/agreement/index.ts";
import type { ReactElement } from "react";
function AgreementsPage({
  agreements,
}: Readonly<{
  agreements: Agreements;
}>): ReactElement {
  const router = useRouter();
  const action = useAction();
  const { accepted, pending } = agreements;
  const signupPending = pending.filter(
    (agreement) => agreement.kind !== AGREEMENT_KIND.interview_history,
  );
  const withdraw = (kind: typeof AGREEMENT_KIND.interview_history): void => {
    action.run(() => withdrawAgreement(kind).then(() => router.invalidate().then(() => undefined)));
  };
  return (
    <Page title="規約への同意">
      <section className="flex flex-col gap-2">
        <Heading as="h2" size="section">
          未同意の版
        </Heading>
        {signupPending.length === 0 ? (
          <StatusMessage>最新の規約に同意しています。</StatusMessage>
        ) : (
          <>
            <PendingAgreementList pending={signupPending} />
            <p className="text-sm leading-normal text-foreground">
              <TextLink to="/agreement">同意の画面へ</TextLink>
            </p>
          </>
        )}
      </section>
      <section className="flex flex-col gap-2">
        <Heading as="h2" size="section">
          同意の履歴
        </Heading>
        {accepted.length === 0 ? (
          <StatusMessage>同意の記録はまだありません。</StatusMessage>
        ) : (
          <ul className="flex flex-col gap-2 text-sm leading-normal text-foreground">
            {accepted.map((agreement) => (
              <li key={agreement.versionId} className="flex flex-col gap-1">
                <span>
                  {agreementKindLabels[agreement.kind]}（{agreement.version}）に
                  {formatWarekiDate(DateTime.toDate(DateTime.makeUnsafe(agreement.acceptedAt)))}同意
                </span>
                {agreement.kind === AGREEMENT_KIND.interview_history && (
                  <Button
                    aria-label="AI インタビューの履歴の利用への同意を取り消す"
                    disabled={action.blocked}
                    onClick={() => {
                      withdraw(AGREEMENT_KIND.interview_history);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    同意を取り消す
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {action.error !== undefined && <p className="text-sm text-destructive">{action.error}</p>}
    </Page>
  );
}
export { AgreementsPage };
