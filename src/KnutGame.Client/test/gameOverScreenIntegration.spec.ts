import { describe, it, expect, beforeEach, vi } from "vitest";
import Phaser from "phaser";

// Mock the AccessibleMessageBox
const mockShowMessage = vi.fn();
const mockClearMessage = vi.fn();
const mockLayout = vi.fn();
const mockDestroy = vi.fn();

vi.mock("../src/ui/AccessibleMessageBox", () => ({
  AccessibleMessageBox: vi.fn().mockImplementation(() => ({
    showMessage: mockShowMessage,
    clearMessage: mockClearMessage,
    layout: mockLayout,
    destroy: mockDestroy,
  })),
}));

// Import after mocking
import { GameOverScreen } from "../src/ui/Hud";

describe("GameOverScreen AccessibleMessageBox Integration", () => {
  let scene: Phaser.Scene;
  let gameOverScreen: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create a minimal Phaser scene mock
    scene = {
      cameras: {
        main: {
          width: 800,
          height: 600,
        },
      },
      add: {
        text: vi.fn().mockReturnValue({
          setOrigin: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setShadow: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setWordWrapWidth: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
        container: vi.fn().mockReturnValue({
          getAt: vi.fn().mockReturnValue({
            width: 100,
            height: 40,
            clear: vi.fn(),
            fillStyle: vi.fn(),
            fillRoundedRect: vi.fn(),
            setPosition: vi.fn(),
          }),
          setDepth: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
          add: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
        graphics: vi.fn().mockReturnValue({
          fillStyle: vi.fn(),
          fillRoundedRect: vi.fn(),
          lineStyle: vi.fn(),
          strokeRoundedRect: vi.fn(),
          clear: vi.fn(),
        }),
        rectangle: vi.fn().mockReturnValue({
          setDepth: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
      },
      tweens: {
        add: vi.fn(),
      },
    } as any;

    // Create GameOverScreen instance
    gameOverScreen = new GameOverScreen(scene);
  });

  it("should initialize AccessibleMessageBox in constructor", () => {
    expect(gameOverScreen).toBeDefined();
    expect(gameOverScreen.accessibleMessageBox).toBeDefined();
  });

  it("should use AccessibleMessageBox for showGameOverMessage", () => {
    const title = "Game Over!";
    const message = "Your final score: 1500 points";

    gameOverScreen.showGameOverMessage(title, message);

    expect(mockShowMessage).toHaveBeenCalledWith({
      title,
      message,
      width: 540, // Math.min(540, 800 - 40)
      position: "center",
      dismissible: false,
      autoClose: undefined,
    });
  });

  it("should call AccessibleMessageBox layout method during layout", () => {
    // Set up some game over elements to trigger layout
    gameOverScreen.gameOverText = { setPosition: vi.fn() };
    
    gameOverScreen.layout();

    expect(mockLayout).toHaveBeenCalled();
  });

  it("should clear AccessibleMessageBox during clearGameOver", () => {
    gameOverScreen.clearGameOver();

    expect(mockClearMessage).toHaveBeenCalled();
  });

  it("should destroy AccessibleMessageBox during destroy", () => {
    gameOverScreen.destroy();

    expect(mockDestroy).toHaveBeenCalled();
  });

  it("should handle showGameOverMessage when AccessibleMessageBox is undefined", () => {
    gameOverScreen.accessibleMessageBox = undefined;

    // Should not throw an error
    expect(() => {
      gameOverScreen.showGameOverMessage("Test", "Message");
    }).not.toThrow();

    expect(mockShowMessage).not.toHaveBeenCalled();
  });

  it("should clear legacy message elements before showing new message", () => {
    // Set up some legacy elements
    const mockDestroy = vi.fn();
    gameOverScreen.gameOverMsgTitle = { destroy: mockDestroy };
    gameOverScreen.gameOverMsgText = { destroy: mockDestroy };
    gameOverScreen.gameOverMsgBg = { destroy: mockDestroy };
    gameOverScreen.gameOverMsgCard = { destroy: mockDestroy };

    gameOverScreen.showGameOverMessage("Test", "Message");

    // Should destroy legacy elements
    expect(mockDestroy).toHaveBeenCalledTimes(4);
    
    // Should clear references
    expect(gameOverScreen.gameOverMsgTitle).toBeUndefined();
    expect(gameOverScreen.gameOverMsgText).toBeUndefined();
    expect(gameOverScreen.gameOverMsgBg).toBeUndefined();
    expect(gameOverScreen.gameOverMsgCard).toBeUndefined();
  });

  it("should maintain backward compatibility with existing game over flow", () => {
    // Test that showGameOver still works
    const result = gameOverScreen.showGameOver();
    
    expect(result).toBeDefined();
    expect(result.restartButton).toBeDefined();
    expect(scene.add.text).toHaveBeenCalled();
  });
});