import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { HudDisplay } from '../src/ui/Hud';
import { TextReadabilityManager } from '../src/utils/textReadability';

// Mock Phaser scene and camera
const mockScene = {
  add: {
    text: vi.fn().mockReturnValue({
      setDepth: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      setFontSize: vi.fn().mockReturnThis(),
      setStroke: vi.fn().mockReturnThis(),
      setShadow: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      style: { fontSize: '16px' },
      text: 'Sample Text'
    })
  },
  cameras: {
    main: {
      width: 800,
      height: 600
    }
  },
  tweens: {
    add: vi.fn()
  }
} as any;

// Mock global devicePixelRatio
Object.defineProperty(globalThis, 'devicePixelRatio', {
  value: 2,
  writable: true
});

describe('HudDisplay Enhancements', () => {
  let hudDisplay: HudDisplay;

  beforeEach(() => {
    vi.clearAllMocks();
    hudDisplay = new HudDisplay(mockScene);
  });

  describe('Accessible Text Styling', () => {
    it('should create HUD elements with accessible text styles', () => {
      expect(mockScene.add.text).toHaveBeenCalledTimes(5); // lives, timer, score, multiplier, best
      
      // Verify all text elements are created with proper depth
      const textCalls = mockScene.add.text.mock.calls;
      textCalls.forEach((call) => {
        const textObject = mockScene.add.text.mock.results[0].value;
        expect(textObject.setDepth).toHaveBeenCalledWith(1000);
      });
    });

    it('should apply proper colors to different HUD elements', () => {
      const textObjects = mockScene.add.text.mock.results.map(result => result.value);
      
      // Verify color assignments - only lives, score, and multiplier get color overrides
      expect(textObjects[0].setColor).toHaveBeenCalledWith("#ff4444"); // lives
      expect(textObjects[2].setColor).toHaveBeenCalledWith("#ffff44"); // score
      expect(textObjects[3].setColor).toHaveBeenCalledWith("#ff8844"); // multiplier
      
      // Timer and best text use the default accessible text style colors (white)
      // They don't get explicit setColor calls since they use the default from createAccessibleTextStyle
    });

    it('should create shield text with accessible styling when activated', () => {
      hudDisplay.setShield(true, 5.0);
      
      // Should create a new text element for shield
      expect(mockScene.add.text).toHaveBeenCalledTimes(6); // 5 initial + 1 shield
      
      const shieldTextObject = mockScene.add.text.mock.results[5].value;
      expect(shieldTextObject.setColor).toHaveBeenCalledWith("#44ffff");
      expect(shieldTextObject.setText).toHaveBeenCalledWith("Shield: 5.0s");
      expect(shieldTextObject.setVisible).toHaveBeenCalledWith(true);
    });
  });

  describe('Responsive Font Scaling', () => {
    it('should update font sizes during layout', () => {
      hudDisplay.layout();
      
      const textObjects = mockScene.add.text.mock.results.map(result => result.value);
      
      // Verify font size updates are called
      textObjects.forEach(textObject => {
        expect(textObject.setFontSize).toHaveBeenCalled();
      });
    });

    it('should position elements correctly during layout', () => {
      hudDisplay.layout();
      
      const textObjects = mockScene.add.text.mock.results.map(result => result.value);
      
      // Verify positioning calls
      expect(textObjects[0].setPosition).toHaveBeenCalledWith(10, 40); // lives
      expect(textObjects[1].setPosition).toHaveBeenCalledWith(10, 70); // timer
      expect(textObjects[2].setPosition).toHaveBeenCalledWith(790, 10); // score (right-aligned)
      expect(textObjects[3].setPosition).toHaveBeenCalledWith(790, 40); // multiplier
      expect(textObjects[4].setPosition).toHaveBeenCalledWith(790, 70); // best
    });
  });

  describe('Enhanced Visual Effects', () => {
    it('should enhance text visibility during pulse animations', () => {
      hudDisplay.pulseScore();
      
      const scoreTextObject = mockScene.add.text.mock.results[2].value;
      
      // Verify stroke and shadow enhancements
      expect(scoreTextObject.setStroke).toHaveBeenCalled();
      expect(scoreTextObject.setShadow).toHaveBeenCalled();
      
      // Verify tween animation is created
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should apply enhanced effects to multiplier pulse', () => {
      hudDisplay.setMultiplier(2); // Set multiplier text first
      hudDisplay.pulseMultiplier();
      
      const multiplierTextObject = mockScene.add.text.mock.results[3].value;
      
      // Verify enhancements are applied
      expect(multiplierTextObject.setStroke).toHaveBeenCalled();
      expect(multiplierTextObject.setShadow).toHaveBeenCalled();
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });

    it('should apply enhanced effects to lives pulse', () => {
      hudDisplay.pulseLives();
      
      const livesTextObject = mockScene.add.text.mock.results[0].value;
      
      // Verify enhancements are applied
      expect(livesTextObject.setStroke).toHaveBeenCalled();
      expect(livesTextObject.setShadow).toHaveBeenCalled();
      expect(mockScene.tweens.add).toHaveBeenCalled();
    });
  });

  describe('Text Content Updates', () => {
    it('should update lives display with proper formatting', () => {
      hudDisplay.setLives(3);
      
      const livesTextObject = mockScene.add.text.mock.results[0].value;
      expect(livesTextObject.setText).toHaveBeenCalledWith("Lives: ♥♥♥");
    });

    it('should update timer display with proper formatting', () => {
      hudDisplay.setTimer(45.7);
      
      const timerTextObject = mockScene.add.text.mock.results[1].value;
      expect(timerTextObject.setText).toHaveBeenCalledWith("Time: 45.7s");
    });

    it('should update score display with proper formatting', () => {
      hudDisplay.setScore(1250);
      
      const scoreTextObject = mockScene.add.text.mock.results[2].value;
      expect(scoreTextObject.setText).toHaveBeenCalledWith("Score: 1250");
    });

    it('should update multiplier display correctly', () => {
      const multiplierTextObject = mockScene.add.text.mock.results[3].value;
      
      // Test with multiplier > 1
      hudDisplay.setMultiplier(3);
      expect(multiplierTextObject.setText).toHaveBeenCalledWith("x3");
      
      // Test with multiplier = 1 (should clear)
      hudDisplay.setMultiplier(1);
      expect(multiplierTextObject.setText).toHaveBeenCalledWith("");
    });

    it('should update best score display with proper formatting', () => {
      hudDisplay.setBest(2500);
      
      const bestTextObject = mockScene.add.text.mock.results[4].value;
      expect(bestTextObject.setText).toHaveBeenCalledWith("Best: 2500");
    });
  });

  describe('Shield Display', () => {
    it('should show shield with proper countdown', () => {
      hudDisplay.setShield(true, 3.2);
      
      const shieldTextObject = mockScene.add.text.mock.results[5].value;
      expect(shieldTextObject.setText).toHaveBeenCalledWith("Shield: 3.2s");
      expect(shieldTextObject.setVisible).toHaveBeenCalledWith(true);
    });

    it('should hide shield when deactivated', () => {
      // First activate shield
      hudDisplay.setShield(true, 5.0);
      const shieldTextObject = mockScene.add.text.mock.results[5].value;
      
      // Then deactivate
      hudDisplay.setShield(false);
      expect(shieldTextObject.setVisible).toHaveBeenCalledWith(false);
    });

    it('should handle shield countdown reaching zero', () => {
      hudDisplay.setShield(true, 0);
      
      const shieldTextObject = mockScene.add.text.mock.results[5].value;
      expect(shieldTextObject.setText).toHaveBeenCalledWith("Shield: 0.0s");
    });
  });

  describe('Accessibility Validation', () => {
    it('should validate text accessibility during layout', () => {
      // Mock console methods to capture validation calls
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      hudDisplay.layout();
      
      // Should call validation for all text elements
      // Note: Actual validation depends on contrast calculations
      expect(consoleSpy.mock.calls.length + consoleWarnSpy.mock.calls.length).toBeGreaterThan(0);
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should destroy all text elements properly', () => {
      // Create shield text
      hudDisplay.setShield(true, 5.0);
      
      const textObjects = mockScene.add.text.mock.results.map(result => result.value);
      
      hudDisplay.destroy();
      
      // Verify all text objects are destroyed
      textObjects.forEach(textObject => {
        expect(textObject.destroy).toHaveBeenCalled();
      });
    });
  });
});