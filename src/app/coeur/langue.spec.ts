import { describe, expect, it } from 'vitest';
import { autreLangue, langueDuNavigateur, langueRetenue } from './langue';

describe('la langue du site', () => {
  it('est le français pour la France et les pays francophones', () => {
    for (const l of ['fr', 'fr-FR', 'fr-BE', 'fr-CA', 'fr-CH', 'fr-SN', 'FR-fr']) {
      expect(langueDuNavigateur([l, 'en-US'])).toBe('fr');
    }
  });

  it('est l’anglais pour tous les autres', () => {
    for (const l of ['en-US', 'de-DE', 'es', 'ja', 'fri']) {
      expect(langueDuNavigateur([l, 'fr-FR'])).toBe('en');
    }
    expect(langueDuNavigateur([])).toBe('en');
  });

  it('ne retient que fr ou en', () => {
    expect(langueRetenue('fr')).toBe('fr');
    expect(langueRetenue('en')).toBe('en');
    expect(langueRetenue('de')).toBeNull();
    expect(langueRetenue(null)).toBeNull();
  });

  it('le bouton propose l’autre langue', () => {
    expect(autreLangue('fr')).toBe('en');
    expect(autreLangue('en')).toBe('fr');
  });
});
