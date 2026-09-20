import { Button, Field } from "@repo/ui";

import { maximumSocialLinks } from "#shared/contracts/index.ts";
import { fieldError } from "#shared/forms/index.ts";
import { SocialLinkIcon, classifySocialUrl } from "#shared/social-link";

import type { ReactElement } from "react";

function SocialLinksEditor({
  errors,
  onChange,
  values,
}: Readonly<{
  errors: readonly unknown[];
  onChange: (values: readonly string[]) => void;
  values: readonly string[];
}>): ReactElement {
  const canAdd = values.length < maximumSocialLinks;
  const linkError = fieldError(errors);
  function updateAt(index: number, url: string): void {
    onChange(values.map((current, currentIndex) => (currentIndex === index ? url : current)));
  }
  function removeAt(index: number): void {
    const next = values.filter((_, currentIndex) => currentIndex !== index);
    onChange(next.length === 0 ? [""] : next);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-normal font-bold">SNS の URL</p>
      {values.map((url, index) => {
        const classified = url === "" ? null : classifySocialUrl(url);
        const invalid = classified !== null && !classified.ok;
        return (
          <div key={`${index}-${url}`} className="flex items-start gap-2">
            <div className="mt-8 text-muted-foreground">
              {url !== "" && <SocialLinkIcon url={url} />}
            </div>
            <div className="min-w-0 flex-1">
              <Field
                label={`URL ${index + 1}`}
                name={`socialLink-${index}`}
                type="text"
                inputMode="url"
                value={url}
                onValueChange={(next) => {
                  updateAt(index, next);
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
                removeAt(index);
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
            onChange([...values, ""]);
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
