import { TextLink } from "@repo/ui";
import { useState } from "react";

import { useContactForm } from "#pages/contact/model/contact-form.ts";
import { ContactFormFields } from "#pages/contact/ui/contact-form-fields.tsx";
import { CardPage } from "#shared/ui/index.ts";

import type { ReactElement } from "react";

function ContactPage(): ReactElement {
  const [sent, setSent] = useState(false);
  const form = useContactForm(() => {
    setSent(true);
  });
  if (sent) {
    return (
      <CardPage title="送信しました">
        <p className="text-base leading-normal">内容を受け付けました。運営からご連絡します。</p>
        <TextLink to="/">トップへ</TextLink>
      </CardPage>
    );
  }
  return (
    <CardPage title="お問い合わせ">
      <p className="text-base leading-normal">会員登録前のご相談など、運営へお送りください。</p>
      <ContactFormFields form={form} />
    </CardPage>
  );
}

export { ContactPage };
