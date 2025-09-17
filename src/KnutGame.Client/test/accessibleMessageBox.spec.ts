import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Phaser from "phaser";
import {
  AccessibleMessageBox,
  type MessageBoxConfig,
} from "../src/ui/AccessibleMessageBox";

// Mock Phaser scene and camera
const mockCamera = {
  width: 800,
  height: 600,
} as Phaser.Cameras.Scene2D.Camera;

const mockScene = {
  cameras: { main: mockCamera },
  add: {
    container: vi.fn(() => ({
      setDepth: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      add: vi.fn().mockReturnThis(),
      destroy: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
    })),
    text: vi.fn(() => ({
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setWordWrapWidth: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      style: { fontSize: "16px", color: "#ffffff" },
      width: 100,
      height: 20,
    })),
    graphics: vi.fn(() => ({
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      fillRoundedRect: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      clear: vi.fn().mockReturnThis(),
    })),
  },
  tweens: {
    add: vi.fn((config) => {
      // Simulate immediate completion for testing
      if (config.onComplete) {
        setTimeout(config.onComplete, 0);
      }
    }),
  },
  time: {
    delayedCall: vi.fn(() => ({
      destroy: vi.fn(),
    })),
  },
} as unknown as Phaser.Scene;

// Mock global devicePixelRatio
Object.defineProperty(globalThis, "devicePixelRatio", {
  value: 1,
  writable: true,
});

describe("AccessibleMessageBox", () => {
  let messageBox: AccessibleMessageBox;

  beforeEach(() => {
    vi.clearAllMocks();
    messageBox = new AccessibleMessageBox(mockScene);
  });

  afterEach(() => {
    messageBox.destroy();
  });

  describe("Constructor", () => {
    it("should initialize with correct scene and camera references", () => {
      expect(messageBox).toBeDefined();
      expect(messageBox["scene"]).toBe(mockScene);
      expect(messageBox["camera"]).toBe(mockCamera);
    });

    it("should initialize with correct device pixel ratio", () => {
      expect(messageBox["dpr"]).toBe(1);
    });

    it("should initialize readability manager and background renderer", () => {
      expect(messageBox["readabilityManager"]).toBeDefined();
      expect(messageBox["backgroundRenderer"]).toBeDefined();
    });

    it("should start with isVisible false", () => {
      expect(messageBox["isVisible"]).toBe(false);
    });
  });

  describe("showMessage", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test Title",
      message: "Test message content",
    };

    it("should display a message with basic configuration", async () => {
      await messageBox.showMessage(basicConfig);

      expect(mockScene.add.container).toHaveBeenCalled();
      expect(mockScene.add.text).toHaveBeenCalledTimes(2); // Title and message
      expect(messageBox["isVisible"]).toBe(true);
    });

    it("should create title text with correct content", async () => {
      await messageBox.showMessage(basicConfig);

      const textCalls = (mockScene.add.text as any).mock.calls;
      const titleCall = textCalls.find((call) => call[2] === "Test Title");
      expect(titleCall).toBeDefined();
    });

    it("should create message text with correct content", async () => {
      await messageBox.showMessage(basicConfig);

      const textCalls = (mockScene.add.text as any).mock.calls;
      const messageCall = textCalls.find(
        (call) => call[2] === "Test message content"
      );
      expect(messageCall).toBeDefined();
    });

    it("should use custom width when provided", async () => {
      const configWithWidth: MessageBoxConfig = {
        ...basicConfig,
        width: 400,
      };

      await messageBox.showMessage(configWithWidth);

      expect(messageBox["currentConfig"]?.width).toBe(400);
    });

    it("should calculate default width based on camera size", async () => {
      await messageBox.showMessage(basicConfig);

      // Should use Math.min(540, camera.width - 40) = Math.min(540, 760) = 540
      const expectedWidth = Math.min(540, mockCamera.width - 40);
      expect(expectedWidth).toBe(540);
    });

    it("should create dismiss button when dismissible is true", async () => {
      const dismissibleConfig: MessageBoxConfig = {
        ...basicConfig,
        dismissible: true,
      };

      await messageBox.showMessage(dismissibleConfig);

      expect(mockScene.add.graphics).toHaveBeenCalled();
      expect(mockScene.add.container).toHaveBeenCalledTimes(3); // Main container + background container + dismiss button
    });

    it("should set up auto-close timer when autoClose is specified", async () => {
      const autoCloseConfig: MessageBoxConfig = {
        ...basicConfig,
        autoClose: 3000,
      };

      await messageBox.showMessage(autoCloseConfig);

      expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
        3000,
        expect.any(Function)
      );
    });

    it("should clear existing message before showing new one", async () => {
      await messageBox.showMessage(basicConfig);
      const firstContainer = messageBox["container"];

      await messageBox.showMessage({ ...basicConfig, title: "New Title" });

      expect(firstContainer?.destroy).toHaveBeenCalled();
    });

    it("should animate in with fade effect", async () => {
      await messageBox.showMessage(basicConfig);

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 1,
          duration: 300,
          ease: "Power2.easeOut",
        })
      );
    });
  });

  describe("Position Calculation", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test",
      message: "Test",
    };

    it("should position at center by default", async () => {
      await messageBox.showMessage(basicConfig);

      const position = messageBox["calculatePosition"]("center", 540, 140);
      expect(position.x).toBe(mockCamera.width / 2);
      expect(position.y).toBe(mockCamera.height / 2 + 90);
    });

    it("should position at top when specified", async () => {
      const topConfig: MessageBoxConfig = {
        ...basicConfig,
        position: "top",
      };

      await messageBox.showMessage(topConfig);

      const position = messageBox["calculatePosition"]("top", 540, 140);
      expect(position.x).toBe(mockCamera.width / 2);
      expect(position.y).toBe(140 / 2 + 40);
    });

    it("should position at bottom when specified", async () => {
      const bottomConfig: MessageBoxConfig = {
        ...basicConfig,
        position: "bottom",
      };

      await messageBox.showMessage(bottomConfig);

      const position = messageBox["calculatePosition"]("bottom", 540, 140);
      expect(position.x).toBe(mockCamera.width / 2);
      expect(position.y).toBe(mockCamera.height - 140 / 2 - 40);
    });
  });

  describe("updateMessage", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Original Title",
      message: "Original message",
    };

    it("should update title and message text", async () => {
      await messageBox.showMessage(basicConfig);

      const mockTitleText = {
        setText: vi.fn(),
        style: { fontSize: "22px", color: "#ffffff", fontStyle: "normal" },
      };
      const mockMessageText = {
        setText: vi.fn(),
        setWordWrapWidth: vi.fn(),
        style: { fontSize: "16px", color: "#ffffff", fontStyle: "normal" },
      };
      messageBox["titleText"] = mockTitleText as any;
      messageBox["messageText"] = mockMessageText as any;

      messageBox.updateMessage("New Title", "New message");

      expect(mockTitleText.setText).toHaveBeenCalledWith("New Title");
      expect(mockMessageText.setText).toHaveBeenCalledWith("New message");
      expect(mockMessageText.setWordWrapWidth).toHaveBeenCalled();
    });

    it("should not update when message is not visible", () => {
      const mockTitleText = { setText: vi.fn() };
      messageBox["titleText"] = mockTitleText as any;

      messageBox.updateMessage("New Title", "New message");

      expect(mockTitleText.setText).not.toHaveBeenCalled();
    });
  });

  describe("High Contrast Mode", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test Title",
      message: "Test message",
    };

    it("should enable high contrast mode", async () => {
      await messageBox.showMessage(basicConfig);

      messageBox.setHighContrastMode(true);

      expect(messageBox["highContrastMode"]).toBe(true);
    });

    it("should update text styling when high contrast mode is toggled", async () => {
      await messageBox.showMessage(basicConfig);

      const mockTitleText = { setStyle: vi.fn() };
      const mockMessageText = { setStyle: vi.fn() };
      messageBox["titleText"] = mockTitleText as any;
      messageBox["messageText"] = mockMessageText as any;

      messageBox.setHighContrastMode(true);

      expect(mockTitleText.setStyle).toHaveBeenCalled();
      expect(mockMessageText.setStyle).toHaveBeenCalled();
    });
  });

  describe("Layout", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test Title",
      message: "Test message",
    };

    it("should update positions when layout is called", async () => {
      await messageBox.showMessage(basicConfig);

      const mockContainer = { setPosition: vi.fn(), destroy: vi.fn() };
      const mockBackgroundContainer = { setPosition: vi.fn() };
      const mockTitleText = { setPosition: vi.fn() };
      const mockMessageText = {
        setPosition: vi.fn(),
        setWordWrapWidth: vi.fn(),
      };
      const mockDismissButton = { setPosition: vi.fn() };

      messageBox["container"] = mockContainer as any;
      messageBox["backgroundContainer"] = mockBackgroundContainer as any;
      messageBox["titleText"] = mockTitleText as any;
      messageBox["messageText"] = mockMessageText as any;
      messageBox["dismissButton"] = mockDismissButton as any;

      messageBox.layout();

      expect(mockContainer.setPosition).toHaveBeenCalledWith(0, 0);
      expect(mockBackgroundContainer.setPosition).toHaveBeenCalled();
      expect(mockTitleText.setPosition).toHaveBeenCalled();
      expect(mockMessageText.setPosition).toHaveBeenCalled();
      expect(mockMessageText.setWordWrapWidth).toHaveBeenCalled();
      expect(mockDismissButton.setPosition).toHaveBeenCalled();
    });

    it("should not update layout when not visible", () => {
      const mockContainer = { setPosition: vi.fn(), destroy: vi.fn() };
      messageBox["container"] = mockContainer as any;

      messageBox.layout();

      expect(mockContainer.setPosition).not.toHaveBeenCalled();
    });
  });

  describe("clearMessage", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test Title",
      message: "Test message",
      autoClose: 5000,
    };

    it("should clear all UI elements and timers", async () => {
      await messageBox.showMessage(basicConfig);

      const mockContainer = { destroy: vi.fn() };
      const mockTimer = { destroy: vi.fn() };
      messageBox["container"] = mockContainer as any;
      messageBox["autoCloseTimer"] = mockTimer as any;

      messageBox.clearMessage();

      expect(mockContainer.destroy).toHaveBeenCalled();
      expect(mockTimer.destroy).toHaveBeenCalled();
      expect(messageBox["isVisible"]).toBe(false);
      expect(messageBox["currentConfig"]).toBeUndefined();
    });

    it("should handle clearing when no elements exist", () => {
      expect(() => messageBox.clearMessage()).not.toThrow();
    });
  });

  describe("Accessibility Validation", () => {
    const basicConfig: MessageBoxConfig = {
      title: "Test Title",
      message: "Test message",
    };

    it("should validate accessibility compliance", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockTitleText = {
        style: { fontSize: "22px", color: "#ffffff", fontStyle: "normal" },
      };
      const mockMessageText = {
        style: { fontSize: "16px", color: "#ffffff", fontStyle: "normal" },
      };

      await messageBox.showMessage(basicConfig);
      messageBox["titleText"] = mockTitleText as any;
      messageBox["messageText"] = mockMessageText as any;

      messageBox["validateAccessibility"]();

      // Should not warn for good contrast
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should warn about poor accessibility compliance", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mockTitleText = {
        style: { fontSize: "8px", color: "#444444", fontStyle: "normal" },
      };
      const mockMessageText = {
        style: { fontSize: "6px", color: "#444444", fontStyle: "normal" },
      };

      await messageBox.showMessage(basicConfig);
      messageBox["titleText"] = mockTitleText as any;
      messageBox["messageText"] = mockMessageText as any;

      messageBox["validateAccessibility"]();

      // Should warn about poor contrast/size
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("Text Styling", () => {
    it("should create accessible text style with semi-transparent background", () => {
      const config = {
        baseSize: 16,
        contrastRatio: "AA" as const,
        backgroundType: "semi-transparent" as const,
        deviceScaling: true,
      };

      const style = messageBox["createAccessibleTextStyle"](config);

      expect(style.color).toBe("#ffffff");
      expect(style.stroke).toBe("#000000");
      expect(style.shadow).toBeDefined();
    });

    it("should create accessible text style with solid background", () => {
      const config = {
        baseSize: 16,
        contrastRatio: "AA" as const,
        backgroundType: "solid" as const,
        deviceScaling: true,
      };

      const style = messageBox["createAccessibleTextStyle"](config);

      expect(style.color).toBe("#333333");
      expect(style.shadow).toBeUndefined();
    });

    it("should create accessible text style with outline", () => {
      const config = {
        baseSize: 16,
        contrastRatio: "AA" as const,
        backgroundType: "outline" as const,
        deviceScaling: true,
      };

      const style = messageBox["createAccessibleTextStyle"](config);

      expect(style.color).toBe("#ffffff");
      expect(style.stroke).toBe("#000000");
      expect(style.strokeThickness).toBeGreaterThan(0);
    });

    it("should create accessible text style with no background", () => {
      const config = {
        baseSize: 16,
        contrastRatio: "AA" as const,
        backgroundType: "none" as const,
        deviceScaling: true,
      };

      const style = messageBox["createAccessibleTextStyle"](config);

      expect(style.color).toBe("#ffffff");
      expect(style.stroke).toBe("#000000");
      expect(style.strokeThickness).toBeGreaterThan(0);
      expect(style.shadow).toBeDefined();
    });

    it("should adjust styling for high contrast mode", () => {
      messageBox.setHighContrastMode(true);

      const config = {
        baseSize: 16,
        contrastRatio: "AA" as const,
        backgroundType: "solid" as const,
        deviceScaling: true,
      };

      const style = messageBox["createAccessibleTextStyle"](config);

      expect(style.color).toBe("#000000"); // High contrast mode uses black text on solid background
    });
  });

  describe("Letter Spacing", () => {
    it("should apply letter spacing when setLetterSpacing method exists", () => {
      const mockText = {
        setLetterSpacing: vi.fn(),
      };

      messageBox["applyLetterSpacing"](mockText as any, 1.0);

      expect(mockText.setLetterSpacing).toHaveBeenCalledWith(1.0);
    });

    it("should apply letter spacing via style when setLetterSpacing method does not exist", () => {
      const mockText = {
        style: {} as any,
        updateText: vi.fn(),
      };

      messageBox["applyLetterSpacing"](mockText as any, 1.0);

      expect(mockText.style.letterSpacing).toBe(1.0);
      expect(mockText.updateText).toHaveBeenCalled();
    });

    it("should handle text objects without letter spacing support", () => {
      const mockText = {};

      expect(() =>
        messageBox["applyLetterSpacing"](mockText as any, 1.0)
      ).not.toThrow();
    });
  });

  describe("Destroy", () => {
    it("should clean up all resources when destroyed", async () => {
      const basicConfig: MessageBoxConfig = {
        title: "Test Title",
        message: "Test message",
        autoClose: 5000,
      };

      await messageBox.showMessage(basicConfig);

      const mockContainer = { destroy: vi.fn() };
      const mockTimer = { destroy: vi.fn() };
      messageBox["container"] = mockContainer as any;
      messageBox["autoCloseTimer"] = mockTimer as any;

      messageBox.destroy();

      expect(mockContainer.destroy).toHaveBeenCalled();
      expect(mockTimer.destroy).toHaveBeenCalled();
      expect(messageBox["isVisible"]).toBe(false);
    });
  });
});
