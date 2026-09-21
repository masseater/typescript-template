export type LocalizedString = import('../runtime.js').LocalizedString;
export type Feature_Search_BodyInputs = {};
/**
* | output |
* | --- |
* | "Search by name and open the profile of someone you care about." |
*
* @param {Feature_Search_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const feature_search_body: ((inputs?: Feature_Search_BodyInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Feature_Search_BodyInputs, {
    locale?: "ja" | "en";
}, {}>;
