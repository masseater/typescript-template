export type LocalizedString = import('../runtime.js').LocalizedString;
export type Features_TitleInputs = {};
/**
* | output |
* | --- |
* | "What you can do" |
*
* @param {Features_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const features_title: ((inputs?: Features_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Features_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
