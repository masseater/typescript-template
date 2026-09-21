export type LocalizedString = import('../runtime.js').LocalizedString;
export type Home_LoadingInputs = {};
/**
* | output |
* | --- |
* | "Loading." |
*
* @param {Home_LoadingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const home_loading: ((inputs?: Home_LoadingInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_LoadingInputs, {
    locale?: "ja" | "en";
}, {}>;
