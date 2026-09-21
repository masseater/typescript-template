export type LocalizedString = import('../runtime.js').LocalizedString;
export type Field_Pattern_MismatchInputs = {};
/**
* | output |
* | --- |
* | "Follow the requested format." |
*
* @param {Field_Pattern_MismatchInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const field_pattern_mismatch: ((inputs?: Field_Pattern_MismatchInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Pattern_MismatchInputs, {
    locale?: "ja" | "en";
}, {}>;
