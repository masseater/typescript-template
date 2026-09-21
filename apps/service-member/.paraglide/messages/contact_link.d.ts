export type LocalizedString = import('../runtime.js').LocalizedString;
export type Contact_LinkInputs = {};
/**
* | output |
* | --- |
* | "Contact" |
*
* @param {Contact_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const contact_link: ((inputs?: Contact_LinkInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Contact_LinkInputs, {
    locale?: "ja" | "en";
}, {}>;
