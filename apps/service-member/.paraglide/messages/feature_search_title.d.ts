export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Search_TitleInputs = {};
/**
* | output |
* | --- |
* | "Find other members" |
*
* @param {Feature_Search_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_search_title: ((inputs?: Feature_Search_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Search_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
