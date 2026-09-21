export type LocalizedString = import('../runtime.js').LocalizedString;
export type Locale_LabelInputs = {};
/**
* | output |
* | --- |
* | "Language" |
*
* @param {Locale_LabelInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const locale_label: ((inputs?: Locale_LabelInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Locale_LabelInputs, {
    locale?: "ja" | "en";
}, {}>;
