import { MemoryStore } from './memory-store';

describe('MemoryStore', () => {
  it('supports set/get/delete/all', () => {
    const store = new MemoryStore();
    store.set('a', '1');
    store.set('b', '2');

    expect(store.get('a')).toBe('1');
    expect(store.all()).toEqual({ a: '1', b: '2' });

    store.delete('a');
    expect(store.get('a')).toBeUndefined();
    expect(store.all()).toEqual({ b: '2' });
  });
});
