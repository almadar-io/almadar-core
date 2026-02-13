import en from './en.json';
import ar from './ar.json';
import sl from './sl.json';

export const i18n = {
    en,
    ar,
    sl
};

export type LanguageCode = keyof typeof i18n;
export type KeywordMap = typeof en.keywords;

export function getKeywords(lang: LanguageCode): KeywordMap {
    return i18n[lang].keywords;
}

export function detectLanguage(content: string): LanguageCode {
    // Simple heuristic: check for unique keywords
    if (content.includes(ar.keywords.orbital) || content.includes(ar.keywords.entity)) return 'ar';
    if (content.includes(sl.keywords.orbital) || content.includes(sl.keywords.entity)) return 'sl';
    return 'en';
}
