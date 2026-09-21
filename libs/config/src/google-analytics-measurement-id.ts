import { Schema } from "effect";

const GoogleAnalyticsMeasurementId = Schema.String.check(Schema.isPattern(/^G-[A-Z0-9]{1,48}$/u));

function activeGoogleAnalyticsMeasurementId(input: {
  readonly GOOGLE_ANALYTICS_MEASUREMENT_ID?: string | undefined;
  readonly local: boolean;
}): string | undefined {
  if (input.local || input.GOOGLE_ANALYTICS_MEASUREMENT_ID === undefined) {
    return undefined;
  }
  return input.GOOGLE_ANALYTICS_MEASUREMENT_ID;
}

export { GoogleAnalyticsMeasurementId, activeGoogleAnalyticsMeasurementId };
