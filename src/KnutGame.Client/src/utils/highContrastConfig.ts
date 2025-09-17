/**
 * High contrast mode configuration and detection utilities
 * 
 * This module provides:
 * - High contrast mode detection from system preferences
 * - Configuration management for high contrast settings
 * - Toggle functionality for manual high contrast mode
 * - Event system for high contrast mode changes
 */

/**
 * High contrast mode configuration options
 */
export interface HighContrastConfig {
  enabled: boolean;
  autoDetect: boolean;
  contrastLevel: 'AA' | 'AAA';
  backgroundType: 'solid' | 'semi-transparent';
  useSystemPreferences: boolean;
}

/**
 * Event listener type for high contrast mode changes
 */
export type HighContrastChangeListener = (enabled: boolean, config: HighContrastConfig) => void;

/**
 * Default high contrast configuration
 */
const DEFAULT_CONFIG: HighContrastConfig = {
  enabled: false,
  autoDetect: true,
  contrastLevel: 'AAA',
  backgroundType: 'solid',
  useSystemPreferences: true
};

/**
 * High contrast mode manager class
 * Handles detection, configuration, and event management for high contrast mode
 */
export class HighContrastManager {
  private config: HighContrastConfig;
  private listeners: Set<HighContrastChangeListener> = new Set();
  private mediaQuery?: MediaQueryList;
  private storageKey = 'knutgame-high-contrast-config';

  constructor() {
    // Load configuration from localStorage or use defaults
    this.config = this.loadConfig();
    
    // Set up system preference detection
    this.setupSystemPreferenceDetection();
    
    // Initialize based on current settings
    this.updateHighContrastState();
  }

  /**
   * Gets the current high contrast configuration
   */
  getConfig(): HighContrastConfig {
    return { ...this.config };
  }

  /**
   * Checks if high contrast mode is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Manually enables or disables high contrast mode
   * @param enabled - Whether to enable high contrast mode
   */
  setEnabled(enabled: boolean): void {
    if (this.config.enabled !== enabled) {
      this.config.enabled = enabled;
      this.config.autoDetect = false; // Disable auto-detect when manually set
      this.saveConfig();
      this.notifyListeners();
    }
  }

  /**
   * Toggles high contrast mode on/off
   * @returns New enabled state
   */
  toggle(): boolean {
    this.setEnabled(!this.config.enabled);
    return this.config.enabled;
  }

  /**
   * Updates the high contrast configuration
   * @param updates - Partial configuration updates
   */
  updateConfig(updates: Partial<HighContrastConfig>): void {
    const oldEnabled = this.config.enabled;
    
    this.config = { ...this.config, ...updates };
    this.saveConfig();
    
    // Update state if auto-detect settings changed
    if (updates.autoDetect !== undefined || updates.useSystemPreferences !== undefined) {
      this.updateHighContrastState();
    }
    
    // Notify if enabled state changed
    if (oldEnabled !== this.config.enabled) {
      this.notifyListeners();
    }
  }

  /**
   * Adds a listener for high contrast mode changes
   * @param listener - Function to call when high contrast mode changes
   */
  addChangeListener(listener: HighContrastChangeListener): void {
    this.listeners.add(listener);
  }

  /**
   * Removes a high contrast mode change listener
   * @param listener - Listener function to remove
   */
  removeChangeListener(listener: HighContrastChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Detects if the system has high contrast preferences enabled
   * @returns True if system prefers high contrast
   */
  detectSystemHighContrast(): boolean {
    // Check for prefers-contrast media query (newer standard)
    if (globalThis.matchMedia) {
      try {
        const prefersContrast = globalThis.matchMedia('(prefers-contrast: high)');
        if (prefersContrast.matches) {
          return true;
        }
      } catch (e) {
        // prefers-contrast not supported, continue with other checks
      }

      // Check for forced-colors (Windows High Contrast Mode)
      try {
        const forcedColors = globalThis.matchMedia('(forced-colors: active)');
        if (forcedColors.matches) {
          return true;
        }
      } catch (e) {
        // forced-colors not supported, continue
      }

      // Check for inverted colors (accessibility feature)
      try {
        const invertedColors = globalThis.matchMedia('(inverted-colors: inverted)');
        if (invertedColors.matches) {
          return true;
        }
      } catch (e) {
        // inverted-colors not supported
      }
    }

    return false;
  }

  /**
   * Gets the appropriate contrast level based on current configuration
   */
  getContrastLevel(): 'AA' | 'AAA' {
    return this.config.contrastLevel;
  }

  /**
   * Gets the appropriate background type for high contrast mode
   */
  getBackgroundType(): 'solid' | 'semi-transparent' {
    return this.config.enabled ? this.config.backgroundType : 'semi-transparent';
  }

  /**
   * Destroys the high contrast manager and cleans up resources
   */
  destroy(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleSystemPreferenceChange);
    }
    this.listeners.clear();
  }

  /**
   * Loads configuration from localStorage
   */
  private loadConfig(): HighContrastConfig {
    try {
      const stored = globalThis.localStorage?.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to load high contrast configuration:', e);
    }
    
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Saves configuration to localStorage
   */
  private saveConfig(): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (e) {
      console.warn('Failed to save high contrast configuration:', e);
    }
  }

  /**
   * Sets up system preference detection using media queries
   */
  private setupSystemPreferenceDetection(): void {
    if (!globalThis.matchMedia || !this.config.useSystemPreferences) {
      return;
    }

    try {
      // Listen for changes in system high contrast preferences
      this.mediaQuery = globalThis.matchMedia('(prefers-contrast: high), (forced-colors: active)');
      this.mediaQuery.addEventListener('change', this.handleSystemPreferenceChange);
    } catch (e) {
      console.warn('Failed to set up system preference detection:', e);
    }
  }

  /**
   * Handles changes in system high contrast preferences
   */
  private handleSystemPreferenceChange = (): void => {
    if (this.config.autoDetect && this.config.useSystemPreferences) {
      this.updateHighContrastState();
    }
  };

  /**
   * Updates the high contrast state based on current configuration
   */
  private updateHighContrastState(): void {
    const oldEnabled = this.config.enabled;
    
    if (this.config.autoDetect && this.config.useSystemPreferences) {
      this.config.enabled = this.detectSystemHighContrast();
    }
    
    if (oldEnabled !== this.config.enabled) {
      this.notifyListeners();
    }
  }

  /**
   * Notifies all listeners of high contrast mode changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.config.enabled, { ...this.config });
      } catch (e) {
        console.error('Error in high contrast change listener:', e);
      }
    });
  }
}

/**
 * Global high contrast manager instance
 */
let globalHighContrastManager: HighContrastManager | null = null;

/**
 * Gets the global high contrast manager instance
 * Creates one if it doesn't exist
 */
export function getHighContrastManager(): HighContrastManager {
  if (!globalHighContrastManager) {
    globalHighContrastManager = new HighContrastManager();
  }
  return globalHighContrastManager;
}

/**
 * Convenience function to check if high contrast mode is enabled
 */
export function isHighContrastEnabled(): boolean {
  return getHighContrastManager().isEnabled();
}

/**
 * Convenience function to toggle high contrast mode
 */
export function toggleHighContrast(): boolean {
  return getHighContrastManager().toggle();
}

/**
 * Convenience function to add a high contrast change listener
 */
export function onHighContrastChange(listener: HighContrastChangeListener): () => void {
  const manager = getHighContrastManager();
  manager.addChangeListener(listener);
  
  // Return cleanup function
  return () => manager.removeChangeListener(listener);
}