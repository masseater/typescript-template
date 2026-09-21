export type LocalizedString = import('../runtime.js').LocalizedString;
export type Locale_EnInputs = {};
/**
* | output |
* | --- |
* | "English" |
*
* @param {Locale_EnInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const locale_en: ((inputs?: Locale_EnInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Locale_EnInputs, {
    locale?: "ja" | "en";
}, {}>;
