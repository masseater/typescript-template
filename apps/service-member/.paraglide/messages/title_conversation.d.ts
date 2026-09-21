export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_ConversationInputs = {};
/**
* | output |
* | --- |
* | "Conversation" |
*
* @param {Title_ConversationInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_conversation: ((inputs?: Title_ConversationInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_ConversationInputs, {
    locale?: "ja" | "en";
}, {}>;
