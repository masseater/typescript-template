export type LocalizedString = import('../runtime.js').LocalizedString;
export type Field_Too_ShortInputs = {};
/**
* | output |
* | --- |
* | "Not enough characters." |
*
* @param {Field_Too_ShortInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const field_too_short: ((inputs?: Field_Too_ShortInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Too_ShortInputs, {
    locale?: "ja" | "en";
}, {}>;
