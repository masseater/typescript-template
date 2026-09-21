export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_SearchInputs = {};
/**
* | output |
* | --- |
* | "Search" |
*
* @param {Title_SearchInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_search: ((inputs?: Title_SearchInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_SearchInputs, {
    locale?: "ja" | "en";
}, {}>;
