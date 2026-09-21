export type LocalizedString = import('../runtime.js').LocalizedString;
export type Home_Empty_ActionInputs = {};
/**
* | output |
* | --- |
* | "Find members" |
*
* @param {Home_Empty_ActionInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const home_empty_action: ((inputs?: Home_Empty_ActionInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Empty_ActionInputs, {
    locale?: "ja" | "en";
}, {}>;
