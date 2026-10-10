/**
 * Storage stand-ins for the tests: one that behaves, one that refuses every
 * access (as some private windows do) and one that fills up after a budget.
 */

export class MemoryStorage implements Storage {
  protected readonly items = new Map<string, string>();

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

/** Every call throws, like localStorage with site data blocked. */
export class BlockedStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  }

  override setItem(): void {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  }

  override key(): string | null {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  }
}

/** Accepts writes until the stored characters exceed the budget. */
export class TinyStorage extends MemoryStorage {
  constructor(private readonly budget: number) {
    super();
  }

  override setItem(key: string, value: string): void {
    let used = key.length + value.length;
    for (const [otherKey, otherValue] of this.items) {
      if (otherKey !== key) used += otherKey.length + otherValue.length;
    }
    if (used > this.budget) throw new DOMException('Quota exceeded', 'QuotaExceededError');
    super.setItem(key, value);
  }
}
