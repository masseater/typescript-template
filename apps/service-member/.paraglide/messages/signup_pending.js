/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Signup_PendingInputs */

const ja_signup_pending = /** @type {(inputs: Signup_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`登録を処理しています。`)
};

const en_signup_pending = /** @type {(inputs: Signup_PendingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Creating your account.`)
};

/**
* | output |
* | --- |
* | "Creating your account." |
*
* @param {Signup_PendingInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const signup_pending = /** @type {((inputs?: Signup_PendingInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Signup_PendingInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_signup_pending(inputs)
	return ja_signup_pending(inputs)
});