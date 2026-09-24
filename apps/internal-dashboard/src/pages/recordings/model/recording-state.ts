import type { PeopleList, RecordingList, RecordingView } from "#shared/contracts/index.ts";
import type { SubmitEventHandler } from "react";

type RegisteredPeople = (typeof PeopleList.Type)["people"];
type RecordingDetail = RecordingView & Readonly<{ people: RegisteredPeople }>;
type RecordingsOverview = Readonly<{
  people: RegisteredPeople;
  recordings: (typeof RecordingList.Type)["recordings"];
}>;

interface RecordingActions {
  readonly blocked: boolean;
  readonly confirmingDelete: boolean;
  readonly error: string | undefined;
  readonly handleAssign: (label: number, personId: string | null) => void;
  readonly handleConfirmDelete: () => void;
  readonly handleDeleteOpenChange: (open: boolean) => void;
  readonly handleRetry: () => void;
}

interface PeopleActions {
  readonly blocked: boolean;
  readonly error: string | undefined;
  readonly handleRemove: (personId: string) => void;
}

interface PersonForm {
  readonly blocked: boolean;
  readonly consented: boolean;
  readonly error: string | undefined;
  readonly handleConsentChange: (consented: boolean) => void;
  readonly handleNameChange: (value: string) => void;
  readonly handleSubmit: SubmitEventHandler<HTMLFormElement>;
  readonly name: string;
  readonly pending: boolean;
}

export type {
  PeopleActions,
  PersonForm,
  RecordingActions,
  RecordingDetail,
  RecordingsOverview,
  RegisteredPeople,
};
