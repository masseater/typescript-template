export type LocalizedString = import('../runtime.js').LocalizedString;
export type Title_NotificationsInputs = {};
/**
* | output |
* | --- |
* | "Notifications" |
*
* @param {Title_NotificationsInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export declare const title_notifications: ((inputs?: Title_NotificationsInputs, options?: {
    locale?: "ja" | "en";
}) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_NotificationsInputs, {
    locale?: "ja" | "en";
}, {}>;
