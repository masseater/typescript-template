/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_ConversationInputs */

const ja_title_conversation = /** @type {(inputs: Title_ConversationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会話`)
};

const en_title_conversation = /** @type {(inputs: Title_ConversationInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Conversation`)
};

/**
* | output |
* | --- |
* | "Conversation" |
*
* @param {Title_ConversationInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_conversation = /** @type {((inputs?: Title_ConversationInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_ConversationInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_conversation(inputs)
	return ja_title_conversation(inputs)
});