/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_NotificationsInputs */

const ja_title_notifications = /** @type {(inputs: Title_NotificationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`通知`)
};

const en_title_notifications = /** @type {(inputs: Title_NotificationsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Notifications`)
};

/**
* | output |
* | --- |
* | "Notifications" |
*
* @param {Title_NotificationsInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_notifications = /** @type {((inputs?: Title_NotificationsInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_NotificationsInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_notifications(inputs)
	return ja_title_notifications(inputs)
});