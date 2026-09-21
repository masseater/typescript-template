import { Button, Field } from "@repo/ui";

import { maximumSocialLinks } from "#shared/contracts/index.ts";
import { SocialLinkIcon, classifySocialUrl } from "#shared/social-link/index.ts";

import type { DraftLink } from "#pages/profile-edit/model/profile-form.ts";
import type { ReactElement } from "react";

function SocialLinksEditor({
  onChange,
  values,
}: Readonly<{
  onChange: (values: readonly DraftLink[]) => void;
  values: readonly DraftLink[];
}>): ReactElement {
  const canAdd = values.length < maximumSocialLinks;
  function updateAt(id: string, url: string): void {
    onChange(values.map((current) => (current.id === id ? { ...current, url } : current)));
  }
  function removeAt(id: string): void {
    onChange(values.filter((current) => current.id !== id));
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-normal font-bold">SNS の URL</p>
      {values.map((draft, index) => {
        const classified = draft.url === "" ? null : classifySocialUrl(draft.url);
        const invalid = classified !== null && !classified.ok;
        return (
          <div key={draft.id} className="flex items-start gap-2">
            <div className="mt-8 text-muted-foreground">
              {draft.url !== "" && <SocialLinkIcon url={draft.url} />}
            </div>
            <div className="min-w-0 flex-1">
              <Field
                label={`URL ${index + 1}`}
                name={`socialLink-${draft.id}`}
                type="text"
                inputMode="url"
                value={draft.url}
                onValueChange={(next) => {
                  updateAt(draft.id, next);
                }}
              />
              {invalid && (
                <p className="mt-1 text-sm leading-normal text-destructive">
                  https で始まる URL を入力してください。
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="small"
              aria-label={`URL ${index + 1} を削除`}
              onClick={() => {
                removeAt(draft.id);
              }}
            >
              削除
            </Button>
          </div>
        );
      })}
      {canAdd && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onChange([...values, { id: crypto.randomUUID(), url: "" }]);
          }}
        >
          URL を追加
        </Button>
      )}
    </div>
  );
}

export { SocialLinksEditor };
