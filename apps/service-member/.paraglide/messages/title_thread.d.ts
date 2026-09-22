export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_ThreadInputs = {};
/**
* | output |
* | --- |
* | "Thread" |
*
* @param {Title_ThreadInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_thread: ((inputs?: Title_ThreadInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_ThreadInputs, {
    locale?: "ja" | "en";
}, {}>;
