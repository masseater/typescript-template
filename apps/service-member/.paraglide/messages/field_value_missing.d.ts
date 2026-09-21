export type LocalizedString = import('../runtime.js').LocalizedString;
export type Field_Value_MissingInputs = {};
/**
* | output |
* | --- |
* | "Enter a value." |
*
* @param {Field_Value_MissingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const field_value_missing: ((inputs?: Field_Value_MissingInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Value_MissingInputs, {
    locale?: "ja" | "en";
}, {}>;
