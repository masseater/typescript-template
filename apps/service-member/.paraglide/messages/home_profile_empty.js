/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_Profile_EmptyInputs */

const ja_home_profile_empty = /** @type {(inputs: Home_Profile_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自己紹介はまだ書かれていません。`)
};

const en_home_profile_empty = /** @type {(inputs: Home_Profile_EmptyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No introduction yet.`)
};

/**
* | output |
* | --- |
* | "No introduction yet." |
*
* @param {Home_Profile_EmptyInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const home_profile_empty = /** @type {((inputs?: Home_Profile_EmptyInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Profile_EmptyInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_home_profile_empty(inputs)
	return ja_home_profile_empty(inputs)
});