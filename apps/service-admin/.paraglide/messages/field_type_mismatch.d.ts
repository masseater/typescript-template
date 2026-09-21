export type LocalizedString = import('../runtime.js').LocalizedString;
export type Field_Type_MismatchInputs = {};
/**
* | output |
* | --- |
* | "Enter a valid format." |
*
* @param {Field_Type_MismatchInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const field_type_mismatch: ((inputs?: Field_Type_MismatchInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Field_Type_MismatchInputs, {
    locale?: "ja" | "en";
}, {}>;
