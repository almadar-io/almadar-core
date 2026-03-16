/**
 * Internationalization (i18n) Support
 *
 * Provides multi-language keyword mappings for the domain language.
 * Supports English, Arabic, and Slovenian keywords.
 *
 * @packageDocumentation
 */

import en from './en.json';
import ar from './ar.json';
import sl from './sl.json';

/**
 * Internationalization data for all supported languages.
 */
export const i18n = {
    en,
    ar,
    sl
};

/**
 * Supported language codes.
 */
export type LanguageCode = keyof typeof i18n;

/**
 * Keyword mapping type for a language.
 */
export type KeywordMap = typeof en.keywords;

/**
 * Get keywords for a specific language.
 *
 * Returns the keyword mappings for the specified language code,
 * which maps domain concepts (entity, behavior, state, etc.)
 * to their localized equivalents.
 *
 * @param {LanguageCode} lang - Language code ('en', 'ar', or 'sl')
 * @returns {KeywordMap} Keyword mappings for the language
 *
 * @example
 * const keywords = getKeywords('ar');
 * // keywords.entity === 'كيان'
 */
export function getKeywords(lang: LanguageCode): KeywordMap {
    return i18n[lang].keywords;
}

/**
 * Detect the language of domain language content.
 *
 * Uses a simple heuristic to detect the language by checking
 * for unique keywords in the content.
 *
 * @param {string} content - Domain language content to analyze
 * @returns {LanguageCode} Detected language code
 *
 * @example
 * detectLanguage('كيان User'); // returns 'ar'
 * detectLanguage('entity User'); // returns 'en'
 */
export function detectLanguage(content: string): LanguageCode {
    // Simple heuristic: check for unique keywords
    if (content.includes(ar.keywords.orbital) || content.includes(ar.keywords.entity)) return 'ar';
    if (content.includes(sl.keywords.orbital) || content.includes(sl.keywords.entity)) return 'sl';
    return 'en';
}
