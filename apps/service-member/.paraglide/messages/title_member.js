/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Title_MemberInputs */

const ja_title_member = /** @type {(inputs: Title_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`会員`)
};

const en_title_member = /** @type {(inputs: Title_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Member`)
};

/**
* | output |
* | --- |
* | "Member" |
*
* @param {Title_MemberInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const title_member = /** @type {((inputs?: Title_MemberInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Title_MemberInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_title_member(inputs)
	return ja_title_member(inputs)
});