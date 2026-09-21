/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Sent_TitleInputs */

const ja_signup_sent_title = /** @type {(inputs: Signup_Sent_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`確認メールを送りました`)
};

const en_signup_sent_title = /** @type {(inputs: Signup_Sent_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Check your email`)
};

/**
* | output |
* | --- |
* | "Check your email" |
*
* @param {Signup_Sent_TitleInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_sent_title = /** @type {((inputs?: Signup_Sent_TitleInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_TitleInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_sent_title(inputs)
	return ja_signup_sent_title(inputs)
});