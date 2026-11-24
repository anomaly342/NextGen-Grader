import { describe, expect, test } from 'bun:test';
import { getInitials } from './initials.ts';

describe('getInitials', () => {
  test('takes the first letter of the first two words, in capitals', () => {
    expect(getInitials('Pimchanok Srisuk')).toBe('PS');
    expect(getInitials('somchai k')).toBe('SK');
  });

  test('ignores extra words and spaces', () => {
    expect(getInitials('  Anan  Chai  Wong ')).toBe('AC');
  });

  test('uses one letter for a one-word name', () => {
    expect(getInitials('Pim')).toBe('P');
  });
});
