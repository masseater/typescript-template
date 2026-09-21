export type LocalizedString = import('../runtime.js').LocalizedString;
export type Locale_JaInputs = {};
/**
* | output |
* | --- |
* | "日本語" |
*
* @param {Locale_JaInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const locale_ja: ((inputs?: Locale_JaInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Locale_JaInputs, {
    locale?: "ja" | "en";
}, {}>;
