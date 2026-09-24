import { usePeopleActions } from "#pages/recordings/model/people-section.ts";
import { usePersonForm } from "#pages/recordings/model/person-form.ts";
import { PeopleSectionView } from "./people-section-view.tsx";

import type { RegisteredPeople } from "#pages/recordings/model/recording-state.ts";
import type { ReactElement } from "react";

function PeopleSection({
  onChanged,
  people,
}: Readonly<{ onChanged: () => Promise<void>; people: RegisteredPeople }>): ReactElement {
  const form = usePersonForm(onChanged);
  const actions = usePeopleActions(onChanged);
  return <PeopleSectionView actions={actions} form={form} people={people} />;
}

export { PeopleSection };
