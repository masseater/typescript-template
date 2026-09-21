export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_MessagesInputs = {};
/**
* | output |
* | --- |
* | "Messages" |
*
* @param {Title_MessagesInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_messages: ((inputs?: Title_MessagesInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_MessagesInputs, {
    locale?: "ja" | "en";
}, {}>;
