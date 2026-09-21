export type LocalizedString = import('../runtime.js').LocalizedString;
export type Home_EmptyInputs = {};
/**
* | output |
* | --- |
* | "No activity from people you follow yet." |
*
* @param {Home_EmptyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const home_empty: ((inputs?: Home_EmptyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_EmptyInputs, {
    locale?: "ja" | "en";
}, {}>;
