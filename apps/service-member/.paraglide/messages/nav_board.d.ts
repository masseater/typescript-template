export type LocalizedString = import('../runtime.js').LocalizedString;
export type Nav_BoardInputs = {};
/**
* | output |
* | --- |
* | "Board" |
*
* @param {Nav_BoardInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const nav_board: ((inputs?: Nav_BoardInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Nav_BoardInputs, {
    locale?: "ja" | "en";
}, {}>;
