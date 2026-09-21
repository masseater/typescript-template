export type LocalizedString = import('../runtime.js').LocalizedString;
export type Closing_TitleInputs = {};
/**
* | output |
* | --- |
* | "Let's get started" |
*
* @param {Closing_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const closing_title: ((inputs?: Closing_TitleInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Closing_TitleInputs, {
    locale?: "ja" | "en";
}, {}>;
