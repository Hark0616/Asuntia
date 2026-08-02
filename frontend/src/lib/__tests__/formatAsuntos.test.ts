import { describe, expect, it } from 'vitest';

import { formatAsuntosCount } from '../formatAsuntos';

describe('formatAsuntosCount', () => {
  it.each([
    [0, '0 asuntos'],
    [1, '1 asunto'],
    [2, '2 asuntos'],
  ])('formatea %s asuntos con concordancia', (count, expected) => {
    expect(formatAsuntosCount(count)).toBe(expected);
  });
});
