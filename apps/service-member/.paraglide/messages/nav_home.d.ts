export type LocalizedString = import('../runtime.js').LocalizedString;
export type Nav_HomeInputs = {};
/**
* | output |
* | --- |
* | "Home" |
*
* @param {Nav_HomeInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const nav_home: ((inputs?: Nav_HomeInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_HomeInputs, {
    locale?: "ja" | "en";
}, {}>;
