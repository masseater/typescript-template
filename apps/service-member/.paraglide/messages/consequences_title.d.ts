export type LocalizedString = import('../runtime.js').LocalizedString;
export type Consequences_TitleInputs = {};
/**
* | output |
* | --- |
* | "Once you have a page" |
*
* @param {Consequences_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const consequences_title: ((inputs?: Consequences_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Consequences_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
