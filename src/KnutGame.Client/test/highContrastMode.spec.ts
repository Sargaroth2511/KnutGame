/**
 * Tests for high contrast mode functionality
 * 
 * This test suite validates:
 * - High contrast mode detection and configuration
 * - Toggle functionality for high contrast mode
 * - Text component updates when high contrast mode changes
 * - System preference detection
 * - Configuration persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  HighContrastManager,
  getHighContrastManager,
  isHighContrastEnabled,
  toggleHighContrast,
  onHighContrastChange,
  type HighContrastConfig,
  type HighContrastChangeListener,
} from '../src/utils/highContrastConfig';
import {
  createHighContrastTextStyle,
  getHighContrastColors,
  TextReadabilityManager,
  type HighContrastTextStyle,
} from '../src/utils/textReadability';

// Mock localStorage
const mockLocalStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => mockLocalStorage.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockLocalStorage.store.set(key, value)),
  removeItem: vi.fn((key: string) => mockLocalStorage.store.delete(key)),
  clear: vi.fn(() => mockLocalStorage.store.clear()),
};

// Mock matchMedia
const mockMatchMedia = vi.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

describe('HighContrastManager', () => {
  let manager: HighContrastManager;

  beforeEach(() => {
    // Reset mocks
    mockLocalStorage.store.clear();
    vi.clearAllMocks();

    // Mock global objects
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(globalThis, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
    });

    manager = new HighContrastManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const config = manager.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.autoDetect).toBe(true);
      expect(config.contrastLevel).toBe('AAA');
      expect(config.backgroundType).toBe('solid');
      expect(config.useSystemPreferences).toBe(true);
    });

    it('should load configuration from localStorage', () => {
      const savedConfig: Partial<HighContrastConfig> = {
        enabled: true,
        contrastLevel: 'AA',
        autoDetect: false,
      };

      mockLocalStorage.store.set('knutgame-high-contrast-config', JSON.stringify(savedConfig));
      
      const newManager = new HighContrastManager();
      const config = newManager.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.contrastLevel).toBe('AA');
      expect(config.autoDetect).toBe(false);
      
      newManager.destroy();
    });

    it('should save configuration to localStorage', () => {
      manager.updateConfig({ enabled: true, contrastLevel: 'AA' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'knutgame-high-contrast-config',
        expect.stringContaining('"enabled":true')
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => {
        manager.updateConfig({ enabled: true });
      }).not.toThrow();
    });
  });

  describe('High Contrast Mode Toggle', () => {
    it('should enable high contrast mode', () => {
      expect(manager.isEnabled()).toBe(false);
      
      manager.setEnabled(true);
      
      expect(manager.isEnabled()).toBe(true);
    });

    it('should disable high contrast mode', () => {
      manager.setEnabled(true);
      expect(manager.isEnabled()).toBe(true);
      
      manager.setEnabled(false);
      
      expect(manager.isEnabled()).toBe(false);
    });

    it('should toggle high contrast mode', () => {
      expect(manager.isEnabled()).toBe(false);
      
      const result1 = manager.toggle();
      expect(result1).toBe(true);
      expect(manager.isEnabled()).toBe(true);
      
      const result2 = manager.toggle();
      expect(result2).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });

    it('should disable auto-detect when manually set', () => {
      expect(manager.getConfig().autoDetect).toBe(true);
      
      manager.setEnabled(true);
      
      expect(manager.getConfig().autoDetect).toBe(false);
    });
  });

  describe('System Preference Detection', () => {
    it('should detect high contrast from prefers-contrast media query', () => {
      mockMatchMedia.mockReturnValue({
        matches: true,
        media: '(prefers-contrast: high)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const result = manager.detectSystemHighContrast();
      
      expect(result).toBe(true);
    });

    it('should detect high contrast from forced-colors media query', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query.includes('forced-colors'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const result = manager.detectSystemHighContrast();
      
      expect(result).toBe(true);
    });

    it('should return false when no high contrast preferences detected', () => {
      mockMatchMedia.mockReturnValue({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const result = manager.detectSystemHighContrast();
      
      expect(result).toBe(false);
    });

    it('should handle matchMedia errors gracefully', () => {
      mockMatchMedia.mockImplementation(() => {
        throw new Error('matchMedia not supported');
      });

      expect(() => {
        manager.detectSystemHighContrast();
      }).not.toThrow();
    });
  });

  describe('Change Listeners', () => {
    it('should notify listeners when high contrast mode changes', () => {
      const listener = vi.fn();
      manager.addChangeListener(listener);
      
      manager.setEnabled(true);
      
      expect(listener).toHaveBeenCalledWith(true, expect.objectContaining({
        enabled: true,
      }));
    });

    it('should not notify listeners when state does not change', () => {
      const listener = vi.fn();
      manager.addChangeListener(listener);
      
      manager.setEnabled(false); // Already false
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove listeners correctly', () => {
      const listener = vi.fn();
      manager.addChangeListener(listener);
      manager.removeChangeListener(listener);
      
      manager.setEnabled(true);
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();
      
      manager.addChangeListener(errorListener);
      manager.addChangeListener(goodListener);
      
      expect(() => {
        manager.setEnabled(true);
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalled();
    });
  });
});

describe('High Contrast Text Styling', () => {
  describe('createHighContrastTextStyle', () => {
    it('should create high contrast text style with white text on black background', () => {
      const style = createHighContrastTextStyle('#ffffff', 0x000000, 16);
      
      expect(style.textColor).toBe('#ffffff');
      expect(style.backgroundColor).toBe(0x000000);
      expect(style.strokeColor).toBe('#000000');
      expect(style.fontWeight).toBe('bold');
      expect(style.shadowEnabled).toBe(true);
    });

    it('should create high contrast text style with black text on white background', () => {
      const style = createHighContrastTextStyle('#000000', 0xffffff, 16);
      
      expect(style.textColor).toBe('#000000');
      expect(style.backgroundColor).toBe(0xffffff);
      expect(style.strokeColor).toBe('#ffffff');
      expect(style.fontWeight).toBe('bold');
    });

    it('should calculate appropriate stroke thickness based on font size', () => {
      const smallStyle = createHighContrastTextStyle('#ffffff', 0x000000, 12);
      const largeStyle = createHighContrastTextStyle('#ffffff', 0x000000, 24);
      
      expect(largeStyle.strokeThickness).toBeGreaterThan(smallStyle.strokeThickness);
      expect(smallStyle.strokeThickness).toBeGreaterThanOrEqual(3);
    });

    it('should choose optimal text color for maximum contrast', () => {
      // Test with a medium gray background - should choose white text
      const style = createHighContrastTextStyle('#888888', 0x808080, 16);
      
      // Should choose either white or black for maximum contrast
      expect(['#ffffff', '#000000']).toContain(style.textColor);
    });
  });

  describe('getHighContrastColors', () => {
    it('should return consistent high contrast color palette', () => {
      const colors = getHighContrastColors();
      
      expect(colors.text).toBe('#ffffff');
      expect(colors.background).toBe(0x000000);
      expect(colors.accent).toBe('#ffff00');
      expect(colors.warning).toBe('#ff8800');
      expect(colors.success).toBe('#00ff00');
      expect(colors.error).toBe('#ff0000');
    });
  });
});

describe('TextReadabilityManager High Contrast Integration', () => {
  let manager: TextReadabilityManager;

  beforeEach(() => {
    manager = new TextReadabilityManager();
  });

  describe('High Contrast Mode State', () => {
    it('should track high contrast mode state', () => {
      expect(manager.isHighContrastMode()).toBe(false);
      
      manager.setHighContrastMode(true);
      
      expect(manager.isHighContrastMode()).toBe(true);
    });

    it('should create high contrast text styles', () => {
      manager.setHighContrastMode(true);
      
      const style = manager.createHighContrastStyle('#ffffff', 0x000000, 16);
      
      expect(style.color).toBe('#ffffff');
      expect(style.fontStyle).toBe('bold');
      expect(style.stroke).toBe('#000000');
      expect(style.strokeThickness).toBeGreaterThan(0);
    });

    it('should provide high contrast colors', () => {
      const colors = manager.getHighContrastColors();
      
      expect(colors).toHaveProperty('text');
      expect(colors).toHaveProperty('background');
      expect(colors).toHaveProperty('accent');
    });
  });
});

describe('Global High Contrast Functions', () => {
  beforeEach(() => {
    // Reset global state
    vi.clearAllMocks();
    mockLocalStorage.store.clear();
  });

  describe('getHighContrastManager', () => {
    it('should return the same instance on multiple calls', () => {
      const manager1 = getHighContrastManager();
      const manager2 = getHighContrastManager();
      
      expect(manager1).toBe(manager2);
    });
  });

  describe('isHighContrastEnabled', () => {
    it('should return current high contrast state', () => {
      expect(isHighContrastEnabled()).toBe(false);
      
      toggleHighContrast();
      
      expect(isHighContrastEnabled()).toBe(true);
    });
  });

  describe('toggleHighContrast', () => {
    it('should toggle high contrast mode and return new state', () => {
      expect(isHighContrastEnabled()).toBe(false);
      
      const result1 = toggleHighContrast();
      expect(result1).toBe(true);
      expect(isHighContrastEnabled()).toBe(true);
      
      const result2 = toggleHighContrast();
      expect(result2).toBe(false);
      expect(isHighContrastEnabled()).toBe(false);
    });
  });

  describe('onHighContrastChange', () => {
    it('should add listener and return cleanup function', () => {
      const listener = vi.fn();
      
      const cleanup = onHighContrastChange(listener);
      
      expect(typeof cleanup).toBe('function');
      
      toggleHighContrast();
      expect(listener).toHaveBeenCalled();
      
      cleanup();
      listener.mockClear();
      
      toggleHighContrast();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('High Contrast Mode Integration Tests', () => {
  let manager: HighContrastManager;
  let textManager: TextReadabilityManager;

  beforeEach(() => {
    mockLocalStorage.store.clear();
    vi.clearAllMocks();

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    Object.defineProperty(globalThis, 'matchMedia', {
      value: mockMatchMedia,
      writable: true,
    });

    manager = new HighContrastManager();
    textManager = new TextReadabilityManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should coordinate between high contrast manager and text manager', () => {
    // Initially both should be disabled
    expect(manager.isEnabled()).toBe(false);
    expect(textManager.isHighContrastMode()).toBe(false);

    // Enable high contrast mode
    manager.setEnabled(true);
    textManager.setHighContrastMode(true);

    expect(manager.isEnabled()).toBe(true);
    expect(textManager.isHighContrastMode()).toBe(true);

    // Test that text styles are different in high contrast mode
    const normalStyle = textManager.createHighContrastStyle('#ffffff', 0x000000, 16);
    expect(normalStyle.fontStyle).toBe('bold');
    expect(normalStyle.strokeThickness).toBeGreaterThan(0);
  });

  it('should persist high contrast settings across sessions', () => {
    // Enable high contrast and verify it's saved
    manager.setEnabled(true);
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'knutgame-high-contrast-config',
      expect.stringContaining('"enabled":true')
    );

    // Create new manager instance and verify it loads the setting
    const newManager = new HighContrastManager();
    expect(newManager.isEnabled()).toBe(true);
    
    newManager.destroy();
  });

  it('should handle system preference changes', () => {
    const listener = vi.fn();
    manager.addChangeListener(listener);

    // Simulate system preference change
    const mediaQuery = {
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    mockMatchMedia.mockReturnValue(mediaQuery);
    
    // Trigger system preference detection
    manager.updateConfig({ autoDetect: true, useSystemPreferences: true });
    
    // Should detect system high contrast preference
    expect(manager.detectSystemHighContrast()).toBe(true);
  });
});