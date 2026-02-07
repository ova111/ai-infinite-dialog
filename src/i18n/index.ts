import * as vscode from 'vscode';
import { zh } from './zh';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';

type TranslationKey = keyof typeof zh;
type Translations = Record<string, string>;

const locales: Record<string, Translations> = {
    'zh': zh,
    'zh-cn': zh,
    'zh-tw': zh,
    'en': en,
    'fr': fr,
    'es': es,
};

let currentLocale: string = 'en';
let currentTranslations: Translations = en;

/**
 * Initialize i18n based on VS Code's language setting.
 * Call this once during extension activation.
 */
export function initI18n(): void {
    const vscodeLang = vscode.env.language.toLowerCase();
    
    // Try exact match first, then prefix match
    if (locales[vscodeLang]) {
        currentLocale = vscodeLang;
        currentTranslations = locales[vscodeLang];
    } else {
        const prefix = vscodeLang.split('-')[0];
        if (locales[prefix]) {
            currentLocale = prefix;
            currentTranslations = locales[prefix];
        } else {
            // Default to English
            currentLocale = 'en';
            currentTranslations = en;
        }
    }
}

/**
 * Get a translated string by key.
 * Supports placeholder replacement: {0}, {1}, etc.
 * 
 * @param key - Translation key
 * @param args - Replacement values for placeholders
 * @returns Translated string
 */
export function t(key: string, ...args: (string | number)[]): string {
    let text = currentTranslations[key] || en[key as keyof typeof en] || key;
    
    // Replace {0}, {1}, etc. with provided arguments
    args.forEach((arg, index) => {
        text = text.replace(`{${index}}`, String(arg));
    });
    
    return text;
}

/**
 * Get the current locale code (e.g., 'en', 'zh', 'fr')
 */
export function getCurrentLocale(): string {
    return currentLocale;
}

/**
 * Get the HTML lang attribute value for the current locale
 */
export function getHtmlLang(): string {
    switch (currentLocale) {
        case 'zh':
        case 'zh-cn':
            return 'zh-CN';
        case 'zh-tw':
            return 'zh-TW';
        case 'fr':
            return 'fr';
        case 'es':
            return 'es';
        default:
            return 'en';
    }
}
