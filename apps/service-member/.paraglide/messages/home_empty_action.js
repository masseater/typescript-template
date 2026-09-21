/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Home_Empty_ActionInputs */

const ja_home_empty_action = /** @type {(inputs: Home_Empty_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`利用者を探す`)
};

const en_home_empty_action = /** @type {(inputs: Home_Empty_ActionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Find members`)
};

/**
* | output |
* | --- |
* | "Find members" |
*
* @param {Home_Empty_ActionInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const home_empty_action = /** @type {((inputs?: Home_Empty_ActionInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Home_Empty_ActionInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_home_empty_action(inputs)
	return ja_home_empty_action(inputs)
});