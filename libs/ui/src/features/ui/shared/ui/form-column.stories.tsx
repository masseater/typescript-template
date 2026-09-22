import { noop } from "es-toolkit";

import preview from "../../../../../storybook/preview";
import { Button } from "./button";
import { Field } from "./field";
import { FormColumn } from "./form-column";

const meta = preview.meta({ component: FormColumn });

export const Default = meta.story({
  args: {
    children: (
      <>
        <Field label="メールアドレス" name="email" type="email" value="" onValueChange={noop} />
        <Field label="パスワード" name="password" type="password" value="" onValueChange={noop} />
        <Button type="submit" variant="primary">
          {"ログイン"}
        </Button>
      </>
    ),
  },
});
