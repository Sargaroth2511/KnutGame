/**
 * Tests to verify font scaling fixes are working correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDeviceScalingFactor, TextReadabilityManager, calculateOptimalFontSize } from '../src/utils/textReadability';

describe('Font Scaling Fixes', () => {
  beforeEach(() => {
    // Mock global objects for consistent testing
    global.globalThis = {
      devicePixelRatio: 1,
      innerWidth: 1920,
      innerHeight: 1080,
      screen: { width: 1920, height: 1080 },
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn()
      }
    } as any;
  });

  describe('getDeviceScalingFactor', () => {
    it('should return conservative scaling for desktop', () => {
      const scalingFactor = getDeviceScalingFactor();
      
      // Desktop should have minimal scaling (around 1.0)
      expect(scalingFactor).toBeGreaterThanOrEqual(0.8);
      expect(scalingFactor).toBeLessThanOrEqual(1.1);
    });

    it('should return appropriate scaling for mobile', () => {
      // Mock mobile environment
      global.globalThis.innerWidth = 375;
      global.globalThis.innerHeight = 667;
      global.globalThis.screen = { width: 375, height: 667 };
      global.globalThis.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' };

      const scalingFactor = getDeviceScalingFactor();
      
      // Mobile should have reasonable scaling (0.9 to 1.4)
      expect(scalingFactor).toBeGreaterThanOrEqual(0.9);
      expect(scalingFactor).toBeLessThanOrEqual(1.4);
    });
  });

  describe('TextReadabilityManager', () => {
    it('should cap font sizes at reasonable maximums', () => {
      const manager = new TextReadabilityManager();
      
      // Test with a base size that could become too large
      const scaledSize = manager.createScaledFontSize(22, 'body');
      const numericSize = parseInt(scaledSize.replace('px', ''));
      
      // Should not exceed 1.5x the base size (22 * 1.5 = 33px)
      expect(numericSize).toBeLessThanOrEqual(33);
      expect(numericSize).toBeGreaterThanOrEqual(12); // Minimum size
    });

    it('should respect minimum font sizes', () => {
      const manager = new TextReadabilityManager();
      
      // Test with a very small base size
      const scaledSize = manager.createScaledFontSize(8, 'body');
      const numericSize = parseInt(scaledSize.replace('px', ''));
      
      // Should enforce minimum size
      expect(numericSize).toBeGreaterThanOrEqual(12);
    });
  });

  describe('calculateOptimalFontSize', () => {
    it('should respect maxSize constraints', () => {
      const config = {
        baseSize: 22,
        minSize: 12,
        maxSize: 28, // 1.3x scaling cap
        scalingFactor: 1.0
      };

      const optimalSize = calculateOptimalFontSize(config);
      
      // Should not exceed maxSize
      expect(optimalSize).toBeLessThanOrEqual(28);
      expect(optimalSize).toBeGreaterThanOrEqual(12);
    });

    it('should handle high scaling factors gracefully', () => {
      const config = {
        baseSize: 16,
        minSize: 12,
        maxSize: 21, // 1.3x scaling cap
        scalingFactor: 2.0 // Artificially high scaling
      };

      const optimalSize = calculateOptimalFontSize(config);
      
      // Should be capped at maxSize despite high scaling factor
      expect(optimalSize).toBeLessThanOrEqual(21);
    });
  });

  describe('Real-world scenarios', () => {
    it('should produce reasonable font sizes for game over message', () => {
      const manager = new TextReadabilityManager();
      
      // Test title size (base 22px)
      const titleSize = manager.createScaledFontSize(22, 'large');
      const titleNumeric = parseInt(titleSize.replace('px', ''));
      
      // Should be reasonable for a title (not too large)
      expect(titleNumeric).toBeGreaterThanOrEqual(18);
      expect(titleNumeric).toBeLessThanOrEqual(33); // 22 * 1.5
      
      // Test message size (base 16px)
      const messageSize = manager.createScaledFontSize(16, 'body');
      const messageNumeric = parseInt(messageSize.replace('px', ''));
      
      // Should be reasonable for body text
      expect(messageNumeric).toBeGreaterThanOrEqual(12);
      expect(messageNumeric).toBeLessThanOrEqual(24); // 16 * 1.5
    });

    it('should handle different device types appropriately', () => {
      // Test desktop scenario
      const desktopManager = new TextReadabilityManager();
      const desktopSize = parseInt(desktopManager.createScaledFontSize(16, 'body').replace('px', ''));
      
      // Mock mobile scenario
      global.globalThis.innerWidth = 375;
      global.globalThis.innerHeight = 667;
      global.globalThis.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' };
      
      const mobileManager = new TextReadabilityManager();
      const mobileSize = parseInt(mobileManager.createScaledFontSize(16, 'body').replace('px', ''));
      
      // Mobile might be slightly larger but both should be reasonable
      expect(desktopSize).toBeGreaterThanOrEqual(12);
      expect(desktopSize).toBeLessThanOrEqual(24);
      expect(mobileSize).toBeGreaterThanOrEqual(12);
      expect(mobileSize).toBeLessThanOrEqual(24);
    });
  });
});