import { Button, Field } from "@repo/ui";

import { newSocialLinkRow } from "#pages/profile-edit/model/profile-form.ts";
import { maximumSocialLinks } from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/index.ts";
import { SocialLinkIcon, classifySocialUrl } from "#shared/social-link";

import type { SocialLinkRow } from "#pages/profile-edit/model/profile-form.ts";
import type { ReactElement } from "react";

function SocialLinksEditor({
  errors,
  onChange,
  values,
}: Readonly<{
  errors: readonly unknown[];
  onChange: (values: readonly SocialLinkRow[]) => void;
  values: readonly SocialLinkRow[];
}>): ReactElement {
  const canAdd = values.length < maximumSocialLinks;
  const linkError = fieldError(errors);
  function updateAt(id: string, url: string): void {
    onChange(values.map((current) => (current.id === id ? { ...current, url } : current)));
  }
  function removeAt(id: string): void {
    const next = values.filter((current) => current.id !== id);
    onChange(next.length === 0 ? [newSocialLinkRow()] : next);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-normal font-bold">SNS の URL</p>
      {values.map((link, index) => {
        const classified = link.url === "" ? null : classifySocialUrl(link.url);
        const invalid = classified !== null && !classified.ok;
        return (
          <div key={link.id} className="flex items-start gap-2">
            <div className="mt-8 text-muted-foreground">
              {link.url !== "" && <SocialLinkIcon url={link.url} />}
            </div>
            <div className="min-w-0 flex-1">
              <Field
                label={`URL ${index + 1}`}
                name={`socialLink-${link.id}`}
                type="text"
                inputMode="url"
                value={link.url}
                onValueChange={(next) => {
                  updateAt(link.id, next);
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
                removeAt(link.id);
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
            onChange([...values, newSocialLinkRow()]);
          }}
        >
          URL を追加
        </Button>
      )}
      {linkError !== undefined && (
        <p className="text-sm leading-normal text-destructive">{linkError}</p>
      )}
    </div>
  );
}

export { SocialLinksEditor };
