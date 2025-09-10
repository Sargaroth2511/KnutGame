import Phaser from 'phaser'
import { MOVE_SPEED } from '../gameConfig'

/**
 * Defines callback functions for pointer input events
 */
interface InputHandlers {
  /** Called when a pointer (touch/mouse) is pressed down */
  onPointerDown: (pointer: Phaser.Input.Pointer) => void;
  /** Called when a pointer (touch/mouse) is released */
  onPointerUp: () => void;
}

/**
 * Contains references to keyboard input controls
 */
interface KeyboardControls {
  /** Arrow key controls */
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  /** WASD key controls */
  wasd: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
}

/**
 * Tracks the current state of directional input
 */
interface InputState {
  /** Whether left movement input is active */
  leftPressed: boolean;
  /** Whether right movement input is active */
  rightPressed: boolean;
}

/**
 * Manages player input from keyboard and touch/pointer devices.
 * Provides event-driven input handling for responsive player movement.
 */
export class InputController {
  private readonly scene: Phaser.Scene;
  private readonly player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  private keyboardControls?: KeyboardControls;
  private inputHandlers?: InputHandlers;
  private inputState: InputState = { leftPressed: false, rightPressed: false };
  private isAttached: boolean = false;

  /**
   * Creates a new InputController instance
   * @param scene - The Phaser scene this controller belongs to
   * @param player - The player object to control (must have a physics body)
   */
  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle) {
    this.scene = scene;
    this.player = player;
  }

  /**
   * Attaches input event handlers to the scene.
   * Sets up keyboard and pointer controls for player movement.
   * Should be called when the scene becomes active.
   */
  attach(): void {
    if (this.isAttached) {
      console.warn('InputController is already attached');
      return;
    }

    this.setupKeyboardControls();
    this.setupPointerControls();
    this.isAttached = true;
  }

  /**
   * Detaches input event handlers from the scene.
   * Cleans up all event listeners and resets input state.
   * Should be called when the scene becomes inactive.
   */
  detach(): void {
    if (!this.isAttached) {
      return;
    }

    this.cleanupKeyboardControls();
    this.cleanupPointerControls();
    this.keyboardControls = undefined;
    this.inputHandlers = undefined;
    this.inputState = { leftPressed: false, rightPressed: false };
    this.isAttached = false;
  }

  /**
   * Updates input state each frame.
   * Should be called in the scene's update() method.
   * Processes current input state and updates player velocity accordingly.
   */
  update(): void {
    if (!this.isAttached) {
      return;
    }

    this.updateVelocityFromInputState();
  }

  /**
   * Sets up keyboard input controls with event listeners for better responsiveness.
   * Creates both arrow key and WASD controls with immediate event-driven response.
   */
  private setupKeyboardControls(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      console.warn('Keyboard input not available');
      return;
    }

    this.keyboardControls = {
      cursors: keyboard.createCursorKeys(),
      wasd: keyboard.addKeys('W,S,A,D') as any
    };

    // Set up event listeners for immediate response
    this.setupKeyEventListeners();
  }

  /**
   * Sets up key event listeners for immediate input response.
   * Uses Phaser's key down/up events instead of polling for better responsiveness.
   */
  private setupKeyEventListeners(): void {
    if (!this.keyboardControls) return;

    const { cursors, wasd } = this.keyboardControls;

    // Left movement keys
    const leftKeys = [cursors.left, wasd.A];
    leftKeys.forEach(key => {
      if (key) {
        key.on('down', () => this.handleLeftKeyDown());
        key.on('up', () => this.handleLeftKeyUp());
      }
    });

    // Right movement keys
    const rightKeys = [cursors.right, wasd.D];
    rightKeys.forEach(key => {
      if (key) {
        key.on('down', () => this.handleRightKeyDown());
        key.on('up', () => this.handleRightKeyUp());
      }
    });
  }

  /**
   * Cleans up keyboard event listeners.
   * Removes all key down/up event handlers to prevent memory leaks.
   */
  private cleanupKeyboardControls(): void {
    if (!this.keyboardControls) return;

    const { cursors, wasd } = this.keyboardControls;

    // Remove all event listeners
    const allKeys = [cursors.left, cursors.right, wasd.A, wasd.D];
    allKeys.forEach(key => {
      if (key) {
        key.off('down');
        key.off('up');
      }
    });
  }

  /**
   * Handles left movement key press.
   * Updates input state and immediately applies velocity change.
   */
  private handleLeftKeyDown(): void {
    this.inputState.leftPressed = true;
    this.inputState.rightPressed = false;
    this.updateVelocityFromInputState();
  }

  /**
   * Handles left movement key release.
   * Updates input state and immediately applies velocity change.
   */
  private handleLeftKeyUp(): void {
    this.inputState.leftPressed = false;
    this.updateVelocityFromInputState();
  }

  /**
   * Handles right movement key press.
   * Updates input state and immediately applies velocity change.
   */
  private handleRightKeyDown(): void {
    this.inputState.rightPressed = true;
    this.inputState.leftPressed = false;
    this.updateVelocityFromInputState();
  }

  /**
   * Handles right movement key release.
   * Updates input state and immediately applies velocity change.
   */
  private handleRightKeyUp(): void {
    this.inputState.rightPressed = false;
    this.updateVelocityFromInputState();
  }

  /**
   * Updates player velocity based on current input state.
   * Applies movement speed in the appropriate direction or stops movement.
   */
  private updateVelocityFromInputState(): void {
    const playerBody = this.getPlayerBody();
    if (!playerBody) return;

    if (this.inputState.leftPressed) {
      playerBody.setVelocityX(-MOVE_SPEED);
    } else if (this.inputState.rightPressed) {
      playerBody.setVelocityX(MOVE_SPEED);
    } else {
      playerBody.setVelocityX(0);
    }
  }

  /**
   * Sets up touch/pointer input controls.
   * Enables touch-based movement for mobile devices.
   */
  private setupPointerControls(): void {
    const input = this.scene.input;
    if (!input) {
      console.warn('Input system not available');
      return;
    }

    this.inputHandlers = {
      onPointerDown: this.createPointerDownHandler(),
      onPointerUp: this.createPointerUpHandler()
    };

    input.on('pointerdown', this.inputHandlers.onPointerDown);
    input.on('pointerup', this.inputHandlers.onPointerUp);
  }

  /**
   * Cleans up pointer input controls.
   * Removes touch/pointer event listeners.
   */
  private cleanupPointerControls(): void {
    if (!this.inputHandlers) {
      return;
    }

    const input = this.scene.input;
    if (input) {
      input.off('pointerdown', this.inputHandlers.onPointerDown);
      input.off('pointerup', this.inputHandlers.onPointerUp);
    }
  }

  /**
   * Creates a handler for pointer down events.
   * Determines movement direction based on screen side touched.
   * @returns Pointer down event handler function
   */
  private createPointerDownHandler(): (pointer: Phaser.Input.Pointer) => void {
    return (pointer: Phaser.Input.Pointer) => {
      const playerBody = this.getPlayerBody();
      if (!playerBody) return;

      const screenCenterX = this.scene.cameras.main.width / 2;
      const velocityX = pointer.x < screenCenterX ? -MOVE_SPEED : MOVE_SPEED;

      // Update input state for consistency
      if (velocityX < 0) {
        this.inputState.leftPressed = true;
        this.inputState.rightPressed = false;
      } else {
        this.inputState.rightPressed = true;
        this.inputState.leftPressed = false;
      }

      playerBody.setVelocityX(velocityX);
    };
  }

  /**
   * Creates a handler for pointer up events.
   * Stops player movement when touch is released.
   * @returns Pointer up event handler function
   */
  private createPointerUpHandler(): () => void {
    return () => {
      const playerBody = this.getPlayerBody();
      if (playerBody) {
        this.inputState.leftPressed = false;
        this.inputState.rightPressed = false;
        playerBody.setVelocityX(0);
      }
    };
  }

  /**
   * Gets the player's physics body safely.
   * Handles type casting and null checking for the physics body.
   * @returns The player's Arcade physics body or null if not available
   */
  private getPlayerBody(): Phaser.Physics.Arcade.Body | null {
    const playerWithBody = this.player as any;
    return playerWithBody.body as Phaser.Physics.Arcade.Body || null;
  }
}
