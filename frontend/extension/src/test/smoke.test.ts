import { describe, it, expect } from 'vitest';

describe('Extension Smoke Test', () => {
  it('should have Chrome APIs mocked', () => {
    expect(chrome).toBeDefined();
    expect(chrome.runtime).toBeDefined();
    expect(chrome.tabs).toBeDefined();
    expect(chrome.storage).toBeDefined();
  });

  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
