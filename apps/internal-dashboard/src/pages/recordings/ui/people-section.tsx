import {
  Button,
  CheckboxField,
  Field,
  FormColumn,
  Heading,
  STATUS_VARIANT,
  StatusMessage,
  formatWarekiDateTime,
} from "@repo/ui";

import { usePeopleActions } from "#pages/recordings/model/people-section.ts";
import { usePersonForm } from "#pages/recordings/model/person-form.ts";
import { maximumPersonNameLength } from "#shared/contracts/index.ts";

import type { RegisteredPeople } from "#pages/recordings/api/recordings.ts";
import type { ReactElement } from "react";

function PeopleSection({
  onChanged,
  people,
}: Readonly<{ onChanged: () => Promise<void>; people: RegisteredPeople }>): ReactElement {
  const form = usePersonForm(onChanged);
  const actions = usePeopleActions(onChanged);
  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-4">
      <Heading as="h2" size="section">
        <span id="people-heading">話者として登録した人</span>
      </Heading>
      <p className="text-base leading-normal text-muted-foreground">
        書き起こしの話者に名前を付けるための一覧です。本人の同意を得てから登録し、求められたら削除してください。
      </p>
      {people.length === 0 ? (
        <StatusMessage variant={STATUS_VARIANT.empty}>登録した人はまだいません。</StatusMessage>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-4">
              <span>
                {person.name}
                <span className="ml-2 text-sm text-muted-foreground">
                  同意 {formatWarekiDateTime(person.consentedAt)}
                </span>
              </span>
              <Button
                type="button"
                variant="danger"
                disabled={actions.blocked}
                action={() => {
                  actions.handleRemove(person.id);
                }}
              >
                削除する
              </Button>
            </li>
          ))}
        </ul>
      )}
      {actions.error === undefined ? null : (
        <StatusMessage variant={STATUS_VARIANT.failure}>{actions.error}</StatusMessage>
      )}
      <form onSubmit={form.handleSubmit} aria-busy={form.pending}>
        <FormColumn>
          <Field
            label="名前"
            name="person-name"
            required
            maxLength={maximumPersonNameLength}
            value={form.name}
            onValueChange={form.handleNameChange}
          />
          <CheckboxField
            checked={form.consented}
            label="本人から、声を書き起こしの話者として記録する同意を得た"
            name="person-consent"
            onCheckedChange={form.handleConsentChange}
          />
          <div>
            <Button type="submit" disabled={form.blocked || !form.consented}>
              登録する
            </Button>
          </div>
          {form.error === undefined ? null : (
            <StatusMessage variant={STATUS_VARIANT.failure}>{form.error}</StatusMessage>
          )}
        </FormColumn>
      </form>
    </section>
  );
}

export { PeopleSection };
