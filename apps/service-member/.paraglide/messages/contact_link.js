/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Contact_LinkInputs */

const ja_contact_link = /** @type {(inputs: Contact_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`お問い合わせ`)
};

const en_contact_link = /** @type {(inputs: Contact_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Contact`)
};

/**
* | output |
* | --- |
* | "Contact" |
*
* @param {Contact_LinkInputs} inputs
* @param {{ locale?: "ja" | "en" }} options
* @returns {LocalizedString}
*/
export const contact_link = /** @type {((inputs?: Contact_LinkInputs, options?: { locale?: "ja" | "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Contact_LinkInputs, { locale?: "ja" | "en" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_contact_link(inputs)
	return ja_contact_link(inputs)
});