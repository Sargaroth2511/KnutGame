/**
 * Abstraction for key-value storage operations.
 * Allows for different storage implementations (localStorage, sessionStorage, in-memory, etc.)
 */
export interface KeyValueStorage {
  /**
   * Retrieves a value from storage by key
   * @param key - The key to look up
   * @returns The stored value as a string, or null if not found
   */
  getItem(key: string): string | null;

  /**
   * Stores a value in storage with the specified key
   * @param key - The key to store the value under
   * @param value - The value to store as a string
   */
  setItem(key: string, value: string): void;
}

/**
 * Service for managing high score persistence using key-value storage.
 * Provides safe storage operations with error handling and data validation.
 */
export class LocalHighscoreService {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  /**
   * Creates a new LocalHighscoreService instance
   * @param storage - Optional storage implementation (defaults to localStorage)
   * @param key - Storage key for the high score (defaults to 'knut_highscore_v1')
   */
  constructor(storage?: KeyValueStorage, key: string = 'knut_highscore_v1') {
    this.storage = storage ?? (globalThis.localStorage as unknown as KeyValueStorage);
    this.key = key;
  }

  /**
   * Retrieves the current high score from storage
   * @returns The stored high score as a non-negative number, or 0 if not found/invalid
   */
  getHighscore(): number {
    try {
      const raw = this.storage?.getItem(this.key);
      const n = raw ? Number(JSON.parse(raw)) : 0;
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch (error) {
      console.warn('Failed to retrieve high score from storage:', error);
      return 0;
    }
  }

  /**
   * Stores a new high score value
   * @param value - The score value to store (will be floored and clamped to non-negative)
   */
  setHighscore(value: number): void {
    if (!this.storage) return;
    const v = Math.max(0, Math.floor(value));
    try {
      this.storage.setItem(this.key, JSON.stringify(v));
    } catch (error) {
      // Ignore storage errors (e.g., quota exceeded, disabled storage) to prevent game crashes
      console.warn('Failed to save high score to storage:', error);
    }
  }
}

// For backward compatibility, export the functions using a default instance
const defaultHighscoreService = new LocalHighscoreService();

/**
 * Retrieves the current high score (legacy function for backward compatibility)
 * @deprecated Use LocalHighscoreService.getHighscore() instead for better control
 * @param storage - Optional custom storage implementation
 * @returns The stored high score as a non-negative number
 */
export function getHighscore(storage?: KeyValueStorage): number {
  const service = storage ? new LocalHighscoreService(storage) : defaultHighscoreService;
  return service.getHighscore();
}

/**
 * Stores a new high score value (legacy function for backward compatibility)
 * @deprecated Use LocalHighscoreService.setHighscore() instead for better control
 * @param value - The score value to store
 * @param storage - Optional custom storage implementation
 */
export function setHighscore(value: number, storage?: KeyValueStorage): void {
  const service = storage ? new LocalHighscoreService(storage) : defaultHighscoreService;
  service.setHighscore(value);
}
