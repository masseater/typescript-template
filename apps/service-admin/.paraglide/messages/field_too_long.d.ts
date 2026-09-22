export type LocalizedString = import('../runtime.js').LocalizedString;
export type Field_Too_LongInputs = {};
/**
* | output |
* | --- |
* | "Too many characters." |
*
* @param {Field_Too_LongInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const field_too_long: ((inputs?: Field_Too_LongInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Too_LongInputs, {
    locale?: "ja" | "en";
}, {}>;
