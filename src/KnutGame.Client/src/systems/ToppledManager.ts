import Phaser from 'phaser'
import { TOPPLE_BLOCK_MS, TOPPLE_DURATION_MS, MAX_TOPPLED, TOPPLE_KNOCKBACK_PX, TOPPLE_IMPACT_SPIN, TOPPLE_DROP_ACCEL, TOPPLE_MAX_DROP_V, TOPPLE_IMPACT_MS, TOPPLE_FALL_VX, TOPPLE_FALL_TAU } from '../gameConfig'
import { toppleTimeline } from './physicsLike'

/**
 * Represents the state of a toppled obstacle during its animation lifecycle.
 */
type ToppledState = 'impact' | 'fallingToGround' | 'toppling' | 'settled'

/**
 * Internal entry representing a toppled obstacle with its animation state.
 */
interface ToppledEntry {
  /** The Phaser sprite representing the toppled obstacle */
  sprite: Phaser.GameObjects.Sprite
  /** The base X position for animation calculations */
  baseX: number
  /** The base Y position for animation calculations */
  baseY: number
  /** Direction of topple: -1 for left, 1 for right */
  dir: 1 | -1
  /** Time elapsed since toppling started */
  elapsed: number
  /** Current animation state */
  state: ToppledState
  /** Time remaining before the obstacle can be collected */
  lifeLeft: number
  /** Current vertical velocity */
  vy: number
  /** Current horizontal velocity */
  vx: number
  /** Time remaining in impact phase */
  impactLeft: number
  /** Initial angle of the sprite when toppling began */
  startAngle: number
}

/**
 * Configuration options for ToppledManager initialization.
 */
interface ToppledManagerConfig {
  /** The Phaser scene this manager belongs to */
  scene: Phaser.Scene
  /** Group for animation sprites */
  animGroup: Phaser.GameObjects.Group
  /** Group for collision-blocking sprites (optional, defaults to animGroup) */
  blockGroup?: Phaser.GameObjects.Group
  /** Y position of the ground for collision detection (optional) */
  groundY?: number
}

/**
 * ToppledManager handles the physics and animation of obstacles that have been toppled
 * by the player. It manages the complete lifecycle from impact through toppling animation
 * to eventual despawn, including collision blocking and visual effects.
 *
 * Key Features:
 * - Multi-phase animation: impact → falling → toppling → settled
 * - Directional toppling based on player position
 * - Automatic capacity management with oldest entry eviction
 * - Collision blocking during topple animation
 * - Smooth physics-based animations with easing
 *
 * @example
 * ```typescript
 * const manager = new ToppledManager({
 *   scene: this,
 *   animGroup: this.toppledAnimGroup,
 *   blockGroup: this.collisionGroup,
 *   groundY: 400
 * });
 *
 * // Add a falling obstacle that was hit by the player
 * manager.addFromFalling(obstacleSprite, player.x);
 *
 * // Update animations each frame
 * manager.update(deltaMs);
 * ```
 */
export class ToppledManager {
  private readonly scene: Phaser.Scene
  private readonly animGroup: Phaser.GameObjects.Group
  private readonly blockGroup: Phaser.GameObjects.Group
  private readonly active: ToppledEntry[] = []
  private readonly groundY?: number

  /**
   * Creates a new ToppledManager instance.
   *
   * @param config - Configuration object for the manager
   */
  constructor(config: ToppledManagerConfig)
  /**
   * @deprecated Use the configuration object constructor instead
   */
  constructor(scene: Phaser.Scene, animGroup: Phaser.GameObjects.Group, blockGroup?: Phaser.GameObjects.Group, groundY?: number)
  constructor(sceneOrConfig: Phaser.Scene | ToppledManagerConfig, animGroup?: Phaser.GameObjects.Group, blockGroup?: Phaser.GameObjects.Group, groundY?: number) {
    // Check if first parameter is a configuration object by checking for required config properties
    const isConfigObject = sceneOrConfig &&
                          typeof sceneOrConfig === 'object' &&
                          'scene' in sceneOrConfig &&
                          'animGroup' in sceneOrConfig &&
                          !(sceneOrConfig instanceof Phaser.Scene)

    if (isConfigObject) {
      // Handle new configuration object signature
      const config = sceneOrConfig as ToppledManagerConfig
      this.scene = config.scene
      this.animGroup = config.animGroup
      this.blockGroup = config.blockGroup ?? config.animGroup
      this.groundY = config.groundY
    } else {
      // Handle deprecated constructor signature
      this.scene = sceneOrConfig as Phaser.Scene
      this.animGroup = animGroup!
      this.blockGroup = blockGroup ?? animGroup!
      this.groundY = groundY
    }
  }

  /**
   * Adds a falling obstacle to the toppled animation system.
   * The obstacle will undergo impact, falling, and toppling animations based on
   * the player's position relative to the obstacle.
   *
   * @param obstacle - The Phaser sprite representing the obstacle
   * @param playerX - The X position of the player for determining topple direction
   *
   * @example
   * ```typescript
   * manager.addFromFalling(obstacle, player.x);
   * ```
   */
  addFromFalling(obstacle: Phaser.GameObjects.Sprite, playerX: number): void {
    // Evict oldest entry if at capacity
    if (this.active.length >= MAX_TOPPLED) {
      const oldEntry = this.active.shift()!
      this.animGroup.remove(oldEntry.sprite)
      oldEntry.sprite.destroy()
    }

    // Preserve initial velocity and disable physics
    const body = (obstacle.body as Phaser.Physics.Arcade.Body | undefined)
    let initialVelocityY = 0
    if (body) {
      initialVelocityY = (body.velocity?.y as number) || 0
      body.setVelocity(0, 0)
      body.enable = false
    }

    // Set sprite origin for proper rotation
    ; (obstacle as any).setOrigin?.(0.5, 1)

    // Determine topple direction based on player position
    const direction: 1 | -1 = (playerX < obstacle.x) ? -1 : 1
    const isSimpleMode = (this.blockGroup === this.animGroup)

    // Create new toppled entry
    const entry: ToppledEntry = {
      sprite: obstacle,
      baseX: obstacle.x,
      baseY: obstacle.y,
      dir: direction,
      elapsed: 0,
      state: isSimpleMode ? 'toppling' : 'impact',
      lifeLeft: TOPPLE_BLOCK_MS,
      vy: Math.min(initialVelocityY, TOPPLE_MAX_DROP_V),
      vx: TOPPLE_FALL_VX * direction,
      impactLeft: TOPPLE_IMPACT_MS,
      startAngle: obstacle.angle || 0
    }

    // Activate and add sprite to scene
    obstacle.setActive(true).setVisible(true)
    this.animGroup.add(obstacle)
    this.active.push(entry)
  }

  /**
   * Updates all active toppled animations. Should be called each frame
   * with the elapsed time since the last update.
   *
   * @param deltaMs - Time elapsed since last update in milliseconds
   *
   * @example
   * ```typescript
   * manager.update(game.loop.delta);
   * ```
   */
  update(deltaMs: number): void {
    for (let i = 0; i < this.active.length; i++) {
      const entry = this.active[i]

      if (entry.state === 'impact') {
        this.updateImpactPhase(entry, deltaMs)
      } else if (entry.state === 'fallingToGround') {
        this.updateFallingPhase(entry, deltaMs)
      } else if (entry.state === 'toppling') {
        this.updateTopplingPhase(entry, deltaMs)
      } else {
        this.updateSettledPhase(entry, deltaMs, i)
      }
    }
  }

  /**
   * Updates an entry during the impact phase where the obstacle is knocked back.
   *
   * @private
   * @param entry - The toppled entry to update
   * @param deltaMs - Time elapsed since last update
   */
  private updateImpactPhase(entry: ToppledEntry, deltaMs: number): void {
    const dt = deltaMs / 1000
    entry.impactLeft -= deltaMs

    // Calculate eased progress for smooth animation
    const progress = 1 - Math.max(0, entry.impactLeft) / TOPPLE_IMPACT_MS
    const eased = 1 - Math.pow(1 - progress, 2)

    // Apply knockback and rotation
    const knockbackX = entry.baseX + TOPPLE_KNOCKBACK_PX * eased * entry.dir
    entry.vy *= Math.max(0, 1 - 3 * dt) // Gently reduce vertical velocity

    entry.sprite.setPosition(knockbackX, entry.baseY)
    entry.sprite.setAngle(entry.startAngle + (TOPPLE_IMPACT_SPIN * eased * entry.dir))

    // Transition to falling phase when impact completes
    if (entry.impactLeft <= 0) {
      entry.state = 'fallingToGround'
    }
  }

  /**
   * Updates an entry during the falling phase where gravity pulls it to the ground.
   *
   * @private
   * @param entry - The toppled entry to update
   * @param deltaMs - Time elapsed since last update
   */
  private updateFallingPhase(entry: ToppledEntry, deltaMs: number): void {
    const dt = deltaMs / 1000

    // Apply gravity and air resistance
    entry.vy = Math.min(entry.vy + TOPPLE_DROP_ACCEL * dt, TOPPLE_MAX_DROP_V)
    entry.vx += (-entry.vx / TOPPLE_FALL_TAU) * dt

    // Update position
    entry.baseX += entry.vx * dt
    entry.baseY += entry.vy * dt

    const spriteBottom = entry.baseY

    // Check for ground collision
    if (this.groundY !== undefined && spriteBottom >= this.groundY) {
      entry.baseY = this.groundY
      entry.state = 'toppling'
      entry.elapsed = 0
      entry.startAngle = entry.sprite.angle

      // Position sprite below player if possible
      try {
        const sceneWithPlayer = this.scene as any
        if (sceneWithPlayer.player && sceneWithPlayer.player.depth !== undefined) {
          entry.sprite.setDepth(sceneWithPlayer.player.depth - 1)
        }
      } catch {
        // Ignore depth setting errors
      }
    }

    entry.sprite.setPosition(entry.baseX, entry.baseY)
  }

  /**
   * Updates an entry during the toppling phase with rotation and sliding animation.
   *
   * @private
   * @param entry - The toppled entry to update
   * @param deltaMs - Time elapsed since last update
   */
  private updateTopplingPhase(entry: ToppledEntry, deltaMs: number): void {
    entry.elapsed += deltaMs

    // Get animation progress from physics timeline
    const timeline = toppleTimeline(entry.elapsed, { durationMs: TOPPLE_DURATION_MS })

    // Calculate size-based scaling for visual variety
    const sizeScale = Math.max(0.9, Math.min(1.6, (entry.sprite.displayHeight || 160) / 160))

    // Apply rotation and sliding
    const angle = entry.startAngle + Math.abs(timeline.angleDeg) * entry.dir
    const slideOffset = timeline.slidePx * sizeScale * entry.dir

    entry.sprite.setAngle(angle)

    const isSimpleMode = (this.blockGroup === this.animGroup) || this.groundY === undefined
    const yPosition = isSimpleMode ? entry.baseY : (this.groundY as number)
    entry.sprite.setPosition(entry.baseX + slideOffset, yPosition)

    // Transition to settled state when animation completes
    if (entry.elapsed >= TOPPLE_DURATION_MS) {
      entry.state = 'settled'

      // Move from animation group to collision group if different
      if (this.animGroup !== this.blockGroup) {
        try {
          (this.animGroup as any).remove?.(entry.sprite)
        } catch {
          // Ignore removal errors
        }
      }

      // Delay before enabling collisions to prevent unfair re-hits
      (this.scene as any).time?.delayedCall?.(150, () => {
        if (entry.sprite.active) {
          this.blockGroup.add(entry.sprite)
        }
      })
    }
  }

  /**
   * Updates an entry in the settled phase, handling despawn timing.
   *
   * @private
   * @param entry - The toppled entry to update
   * @param deltaMs - Time elapsed since last update
   * @param index - Index of the entry in the active array
   */
  private updateSettledPhase(entry: ToppledEntry, deltaMs: number, index: number): void {
    entry.lifeLeft -= deltaMs

    if (entry.lifeLeft <= 0) {
      // Create fade-out tween before destruction
      this.scene.tweens.add({
        targets: entry.sprite,
        alpha: 0,
        duration: 180,
        onComplete: () => {
          entry.sprite.destroy()
        }
      })

      // Remove from collision group and active array
      this.blockGroup.remove(entry.sprite)
      this.active.splice(index, 1)
    }
  }

  /**
   * Clears all active toppled entries, destroying sprites and canceling animations.
   * Useful for scene transitions or game resets.
   *
   * @example
   * ```typescript
   * manager.clear();
   * ```
   */
  clear(): void {
    // Kill any active tweens and destroy sprites
    for (const entry of this.active) {
      try {
        (this.scene as any).tweens?.killTweensOf?.(entry.sprite)
      } catch {
        // Ignore tween killing errors
      }

      try {
        entry.sprite.destroy()
      } catch {
        // Ignore destruction errors
      }
    }

    // Clear groups and reset active array
    this.animGroup.clear(true, true)
    this.blockGroup.clear(true, true)
    this.active.length = 0
  }
}
