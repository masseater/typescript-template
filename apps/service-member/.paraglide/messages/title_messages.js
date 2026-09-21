/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_MessagesInputs */

const ja_title_messages = /** @type {(inputs: Title_MessagesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`メッセージ`)
};

const en_title_messages = /** @type {(inputs: Title_MessagesInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Messages`)
};

/**
* | output |
* | --- |
* | "Messages" |
*
* @param {Title_MessagesInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_messages = /** @type {((inputs?: Title_MessagesInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_MessagesInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_messages(inputs)
	return ja_title_messages(inputs)
});