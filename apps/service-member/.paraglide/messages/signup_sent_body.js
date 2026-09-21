/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_Sent_BodyInputs */

const ja_signup_sent_body = /** @type {(inputs: Signup_Sent_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`メールのリンクを開いてメールアドレスの確認を済ませてから、ログインしてください。`)
};

const en_signup_sent_body = /** @type {(inputs: Signup_Sent_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Open the link in the email to verify your address, then log in.`)
};

/**
* | output |
* | --- |
* | "Open the link in the email to verify your address, then log in." |
*
* @param {Signup_Sent_BodyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_sent_body = /** @type {((inputs?: Signup_Sent_BodyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_Sent_BodyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_sent_body(inputs)
	return ja_signup_sent_body(inputs)
});