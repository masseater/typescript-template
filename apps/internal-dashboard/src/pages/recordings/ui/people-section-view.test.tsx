import { renderedAt } from "@repo/ui/testing";
import { describe, expect, it } from "vite-plus/test";

import { PeopleSectionView } from "./people-section-view.tsx";

import type {
  PeopleActions,
  PersonForm,
  RegisteredPeople,
} from "#pages/recordings/model/recording-state.ts";

const actions: PeopleActions = {
  blocked: false,
  error: undefined,
  handleRemove: () => undefined,
};

const form: PersonForm = {
  blocked: false,
  consented: false,
  error: undefined,
  handleConsentChange: () => undefined,
  handleNameChange: () => undefined,
  handleSubmit: () => undefined,
  name: "",
  pending: false,
};

const registered: RegisteredPeople = [{ consentedAt: 0, id: "person-1", name: "山田" }];

function rendered(
  people: RegisteredPeople,
  shown: Readonly<{ actions?: Partial<PeopleActions>; form?: Partial<PersonForm> }> = {},
): string {
  return renderedAt(
    <PeopleSectionView
      actions={{ ...actions, ...shown.actions }}
      form={{ ...form, ...shown.form }}
      people={people}
    />,
    ["/"],
  );
}

describe("registered speakers", () => {
  it("says nobody is registered yet", () => {
    expect(rendered([])).toContain("登録した人はまだいません。");
  });

  it("lists each registered person", () => {
    expect(rendered(registered)).toContain("山田");
  });

  it("shows a removal failure", () => {
    expect(rendered(registered, { actions: { error: "削除できませんでした。" } })).toContain(
      "削除できませんでした。",
    );
  });

  it("shows a registration failure", () => {
    expect(rendered([], { form: { error: "登録できませんでした。" } })).toContain(
      "登録できませんでした。",
    );
  });
});
