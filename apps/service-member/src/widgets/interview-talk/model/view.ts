import type { InterviewView } from "#shared/interview/index.ts";

type InterviewViewData = typeof InterviewView.Type;
type FieldViewData = InterviewViewData["fields"][number];

export type { FieldViewData, InterviewViewData };
