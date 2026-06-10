/**
 * ============================================
 * BeautifyPRO - Mock Store Tests
 * localStorage-backed demo collections
 * ============================================
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MOCK_STORE_KEYS,
  readMockCollection,
  addToMockCollection,
  removeFromMockCollection,
  updateMockCollection,
  mockId,
} from '@/lib/mock/mock-store';

type Item = { id: string; name: string };
const KEY = MOCK_STORE_KEYS.customers;

function stubLocalStorage() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  vi.stubGlobal('window', { localStorage });
  return data;
}

describe('mock-store', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] without a browser environment (SSR)', () => {
    expect(readMockCollection<Item>(KEY)).toEqual([]);
    expect(addToMockCollection<Item>(KEY, { id: '1', name: 'x' })).toEqual([]);
  });

  it('adds and reads items', () => {
    stubLocalStorage();
    addToMockCollection<Item>(KEY, { id: '1', name: 'Anna' });
    const items = addToMockCollection<Item>(KEY, { id: '2', name: 'Ben' });
    expect(items).toHaveLength(2);
    expect(readMockCollection<Item>(KEY)).toEqual(items);
  });

  it('survives corrupt JSON', () => {
    const data = stubLocalStorage();
    data.set(KEY, '{not json');
    expect(readMockCollection<Item>(KEY)).toEqual([]);
  });

  it('removes items by predicate', () => {
    stubLocalStorage();
    addToMockCollection<Item>(KEY, { id: '1', name: 'Anna' });
    addToMockCollection<Item>(KEY, { id: '2', name: 'Ben' });
    const items = removeFromMockCollection<Item>(KEY, (i) => i.id === '1');
    expect(items).toEqual([{ id: '2', name: 'Ben' }]);
  });

  it('updates items by predicate', () => {
    stubLocalStorage();
    addToMockCollection<Item>(KEY, { id: '1', name: 'Anna' });
    const items = updateMockCollection<Item>(
      KEY,
      (i) => i.id === '1',
      (i) => ({ ...i, name: 'Anna B.' })
    );
    expect(items[0].name).toBe('Anna B.');
  });

  it('generates unique prefixed ids', () => {
    const a = mockId('cust');
    const b = mockId('cust');
    expect(a).toMatch(/^cust-/);
    expect(a).not.toBe(b);
  });
});
