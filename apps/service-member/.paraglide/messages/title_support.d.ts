export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_SupportInputs = {};
/**
* | output |
* | --- |
* | "Contact" |
*
* @param {Title_SupportInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_support: ((inputs?: Title_SupportInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_SupportInputs, {
    locale?: "ja" | "en";
}, {}>;
