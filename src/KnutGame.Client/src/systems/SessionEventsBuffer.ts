import { ItemType } from '../items'

/**
 * Configuration options for the SessionEventsBuffer.
 * Defines buffer limits, performance settings, and behavior parameters.
 */
interface SessionEventsBufferConfig {
  /** Maximum number of events to store in each buffer before oldest are removed */
  maxEventsPerType: number;
  /** Whether to enable automatic cleanup when limits are exceeded */
  enableAutoCleanup: boolean;
  /** Whether to round timestamps to nearest millisecond */
  roundTimestamps: boolean;
  /** Whether to validate event data before adding */
  enableValidation: boolean;
}

/**
 * Represents a player movement event with timestamp and position.
 * Used to track player movement patterns during gameplay.
 */
interface MoveEvent {
  /** Timestamp in milliseconds when the movement occurred */
  t: number;
  /** X coordinate of the player's position */
  x: number;
}

/**
 * Represents a hit/damage event with timestamp.
 * Used to track combat interactions and damage events.
 */
interface HitEvent {
  /** Timestamp in milliseconds when the hit occurred */
  t: number;
}

/**
 * Represents an item collection or interaction event.
 * Used to track item pickups, power-ups, and other item-related events.
 */
interface ItemEvent {
  /** Timestamp in milliseconds when the item event occurred */
  t: number;
  /** Unique identifier for the item instance */
  id: string;
  /** Type of the item (gift, heart, snowflake, etc.) */
  type: ItemType;
  /** X coordinate where the item was collected */
  x: number;
  /** Y coordinate where the item was collected */
  y: number;
}

/**
 * Statistics about the current state of the events buffer.
 * Provides insights into buffer usage and performance.
 */
interface BufferStats {
  /** Total number of move events stored */
  moveCount: number;
  /** Total number of hit events stored */
  hitCount: number;
  /** Total number of item events stored */
  itemCount: number;
  /** Total number of all events combined */
  totalEvents: number;
  /** Memory usage estimate in bytes */
  estimatedMemoryUsage: number;
}

/**
 * Query options for filtering and retrieving events.
 * Allows selective access to events within time ranges or by type.
 */
interface EventQueryOptions {
  /** Start time for filtering events (inclusive) */
  startTime?: number;
  /** End time for filtering events (inclusive) */
  endTime?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Whether to sort results by timestamp (ascending) */
  sortByTime?: boolean;
}

/**
 * Collection of all game session events organized by type.
 * This structure captures the complete gameplay session data.
 */
interface SessionEvents {
  /** Array of player movement events */
  moves: MoveEvent[];
  /** Array of hit/damage events */
  hits: HitEvent[];
  /** Array of item collection events */
  items: ItemEvent[];
}

/**
 * Result of an event addition operation.
 * Provides feedback about the operation's success and any side effects.
 */
interface EventAdditionResult {
  /** Whether the event was successfully added */
  success: boolean;
  /** Reason for failure (if applicable) */
  error?: string;
  /** Whether cleanup occurred due to buffer limits */
  cleanupPerformed?: boolean;
  /** Number of events removed during cleanup */
  eventsRemoved?: number;
}

/**
 * Advanced session events buffer with performance optimization and memory management.
 * Manages game session events including player movements, hits, and item collections.
 * Provides efficient storage, querying, and cleanup capabilities for gameplay analytics.
 */
export class SessionEventsBuffer {
  private events: SessionEvents = { moves: [], hits: [], items: [] };
  private config: SessionEventsBufferConfig;

  /**
   * Creates a new SessionEventsBuffer instance
   * @param config - Configuration options for buffer behavior (optional, uses defaults if not provided)
   */
  constructor(config?: Partial<SessionEventsBufferConfig>) {
    this.config = {
      maxEventsPerType: 10000,
      enableAutoCleanup: true,
      roundTimestamps: true,
      enableValidation: true,
      ...config
    };
  }

  /**
   * Resets the buffer by clearing all stored events.
   * This operation cannot be undone and should be used carefully.
   */
  reset(): void {
    this.events = { moves: [], hits: [], items: [] };
  }

  /**
   * Creates a deep copy of the current events buffer.
   * Useful for creating snapshots for analysis or transmission.
   * @returns A complete copy of all current events
   */
  snapshot(): SessionEvents {
    return {
      moves: [...this.events.moves],
      hits: [...this.events.hits],
      items: [...this.events.items]
    };
  }

  /**
   * Adds a player movement event to the buffer.
   * @param tMs - Timestamp in milliseconds when the movement occurred
   * @param x - X coordinate of the player's position
   * @returns Result indicating success or failure of the operation
   */
  pushMove(tMs: number, x: number): EventAdditionResult {
    if (this.config.enableValidation && (!this.isValidTimestamp(tMs) || !this.isValidCoordinate(x))) {
      return {
        success: false,
        error: 'Invalid timestamp or coordinate provided'
      };
    }

    const timestamp = this.config.roundTimestamps ? Math.round(tMs) : tMs;
    const moveEvent: MoveEvent = { t: timestamp, x };

    this.events.moves.push(moveEvent);

    const cleanupResult = this.performCleanupIfNeeded('moves');
    return {
      success: true,
      cleanupPerformed: cleanupResult.cleanupPerformed,
      eventsRemoved: cleanupResult.eventsRemoved
    };
  }

  /**
   * Adds a hit/damage event to the buffer.
   * @param tMs - Timestamp in milliseconds when the hit occurred
   * @returns Result indicating success or failure of the operation
   */
  pushHit(tMs: number): EventAdditionResult {
    if (this.config.enableValidation && !this.isValidTimestamp(tMs)) {
      return {
        success: false,
        error: 'Invalid timestamp provided'
      };
    }

    const timestamp = this.config.roundTimestamps ? Math.round(tMs) : tMs;
    const hitEvent: HitEvent = { t: timestamp };

    this.events.hits.push(hitEvent);

    const cleanupResult = this.performCleanupIfNeeded('hits');
    return {
      success: true,
      cleanupPerformed: cleanupResult.cleanupPerformed,
      eventsRemoved: cleanupResult.eventsRemoved
    };
  }

  /**
   * Adds an item collection event to the buffer.
   * @param tMs - Timestamp in milliseconds when the item was collected
   * @param id - Unique identifier for the item instance
   * @param type - Type of the item (gift, heart, snowflake, etc.)
   * @param x - X coordinate where the item was collected
   * @param y - Y coordinate where the item was collected
   * @returns Result indicating success or failure of the operation
   */
  pushItem(tMs: number, id: string, type: ItemType, x: number, y: number): EventAdditionResult {
    if (this.config.enableValidation) {
      if (!this.isValidTimestamp(tMs)) {
        return { success: false, error: 'Invalid timestamp provided' };
      }
      if (!this.isValidId(id)) {
        return { success: false, error: 'Invalid item ID provided' };
      }
      if (!this.isValidCoordinate(x) || !this.isValidCoordinate(y)) {
        return { success: false, error: 'Invalid coordinates provided' };
      }
    }

    const timestamp = this.config.roundTimestamps ? Math.round(tMs) : tMs;
    const itemEvent: ItemEvent = { t: timestamp, id, type, x, y };

    this.events.items.push(itemEvent);

    const cleanupResult = this.performCleanupIfNeeded('items');
    return {
      success: true,
      cleanupPerformed: cleanupResult.cleanupPerformed,
      eventsRemoved: cleanupResult.eventsRemoved
    };
  }

  /**
   * Retrieves events within a specified time range.
   * @param options - Query options for filtering events
   * @returns Filtered events matching the query criteria
   */
  queryEvents(options: EventQueryOptions = {}): SessionEvents {
    const { startTime, endTime, limit, sortByTime = true } = options;

    let filteredMoves: MoveEvent[] = this.filterEventsByTime(this.events.moves, startTime, endTime);
    let filteredHits: HitEvent[] = this.filterEventsByTime(this.events.hits, startTime, endTime);
    let filteredItems: ItemEvent[] = this.filterEventsByTime(this.events.items, startTime, endTime);

    if (sortByTime) {
      filteredMoves = this.sortEventsByTime(filteredMoves);
      filteredHits = this.sortEventsByTime(filteredHits);
      filteredItems = this.sortEventsByTime(filteredItems);
    }

    if (limit !== undefined) {
      filteredMoves = filteredMoves.slice(0, limit);
      filteredHits = filteredHits.slice(0, limit);
      filteredItems = filteredItems.slice(0, limit);
    }

    return {
      moves: filteredMoves,
      hits: filteredHits,
      items: filteredItems
    };
  }

  /**
   * Gets statistics about the current buffer state.
   * @returns Comprehensive statistics about buffer usage and memory
   */
  getStats(): BufferStats {
    const moveCount = this.events.moves.length;
    const hitCount = this.events.hits.length;
    const itemCount = this.events.items.length;
    const totalEvents = moveCount + hitCount + itemCount;

    // Rough memory estimation (each event ~50-100 bytes)
    const estimatedMemoryUsage = totalEvents * 80;

    return {
      moveCount,
      hitCount,
      itemCount,
      totalEvents,
      estimatedMemoryUsage
    };
  }

  /**
   * Updates the buffer configuration.
   * @param newConfig - Partial configuration to update
   */
  updateConfig(newConfig: Partial<SessionEventsBufferConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Gets the current configuration.
   * @returns A copy of the current buffer configuration
   */
  getConfig(): SessionEventsBufferConfig {
    return { ...this.config };
  }

  /**
   * Manually triggers cleanup for all event types.
   * @returns Summary of cleanup operations performed
   */
  forceCleanup(): { totalRemoved: number; typesCleaned: string[] } {
    let totalRemoved = 0;
    const typesCleaned: string[] = [];

    ['moves', 'hits', 'items'].forEach(type => {
      const result = this.performCleanupIfNeeded(type as keyof SessionEvents);
      if (result.cleanupPerformed) {
        totalRemoved += result.eventsRemoved || 0;
        typesCleaned.push(type);
      }
    });

    return { totalRemoved, typesCleaned };
  }

  /**
   * Validates a timestamp value.
   * @param timestamp - Timestamp to validate
   * @returns True if timestamp is valid, false otherwise
   * @private
   */
  private isValidTimestamp(timestamp: number): boolean {
    return typeof timestamp === 'number' && timestamp >= 0 && !isNaN(timestamp) && isFinite(timestamp);
  }

  /**
   * Validates a coordinate value.
   * @param coordinate - Coordinate to validate
   * @returns True if coordinate is valid, false otherwise
   * @private
   */
  private isValidCoordinate(coordinate: number): boolean {
    return typeof coordinate === 'number' && !isNaN(coordinate) && isFinite(coordinate);
  }

  /**
   * Validates an item ID.
   * @param id - ID to validate
   * @returns True if ID is valid, false otherwise
   * @private
   */
  private isValidId(id: string): boolean {
    return typeof id === 'string' && id.length > 0 && id.length <= 100;
  }

  /**
   * Performs cleanup if the buffer exceeds configured limits.
   * @param eventType - Type of events to check and potentially clean
   * @returns Result of the cleanup operation
   * @private
   */
  private performCleanupIfNeeded(eventType: keyof SessionEvents): { cleanupPerformed: boolean; eventsRemoved?: number } {
    if (!this.config.enableAutoCleanup) {
      return { cleanupPerformed: false };
    }

    const eventArray = this.events[eventType];
    if (eventArray.length <= this.config.maxEventsPerType) {
      return { cleanupPerformed: false };
    }

    const eventsToRemove = eventArray.length - this.config.maxEventsPerType;
    eventArray.splice(0, eventsToRemove); // Remove oldest events

    return {
      cleanupPerformed: true,
      eventsRemoved: eventsToRemove
    };
  }

  /**
   * Filters events by time range.
   * @param events - Array of events to filter
   * @param startTime - Start time for filtering (inclusive)
   * @param endTime - End time for filtering (inclusive)
   * @returns Filtered array of events
   * @private
   */
  private filterEventsByTime<T extends { t: number }>(events: T[], startTime?: number, endTime?: number): T[] {
    return events.filter(event => {
      if (startTime !== undefined && event.t < startTime) return false;
      if (endTime !== undefined && event.t > endTime) return false;
      return true;
    });
  }

  /**
   * Sorts events by timestamp in ascending order.
   * @param events - Array of events to sort
   * @returns Sorted array of events
   * @private
   */
  private sortEventsByTime<T extends { t: number }>(events: T[]): T[] {
    return [...events].sort((a, b) => a.t - b.t);
  }
}

// Legacy type exports for backward compatibility
export type { SessionEvents };

