import { Field, fieldError } from "@template/ui";
import type { ReactElement } from "react";
import type { TextFieldApi } from "@template/ui";
import { maximumProfileLength } from "@template/runtime/contracts";

function ProfileBiography({ field }: Readonly<{ field: TextFieldApi }>): ReactElement {
  return (
    <>
      <Field
        multiline
        label="自己紹介"
        name="profile"
        maxLength={maximumProfileLength}
        value={field.state.value}
        error={fieldError(field.state.meta.errors)}
        onValueChange={field.handleChange}
      />
      <p className="text-sm leading-normal text-muted-foreground">
        残り {maximumProfileLength - field.state.value.length} 文字
      </p>
    </>
  );
}

export { ProfileBiography };
