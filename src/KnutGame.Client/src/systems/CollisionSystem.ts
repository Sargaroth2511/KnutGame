import Phaser from 'phaser'
import { COLLIDE_SHRINK_PLAYER, COLLIDE_SHRINK_ITEM, OBST_COLLIDE_WIDTH_FRAC, OBST_COLLIDE_HEIGHT_FRAC, HITBOX_GLOBAL_SHRINK } from '../gameConfig'

/**
 * Represents an oriented bounding box for collision detection.
 * OBBs can be rotated and provide more accurate collision detection than axis-aligned bounding boxes.
 */
interface OrientedBoundingBox {
  /** X coordinate of the box center */
  centerX: number;
  /** Y coordinate of the box center */
  centerY: number;
  /** Half-width of the box (distance from center to edge along width axis) */
  halfWidth: number;
  /** Half-height of the box (distance from center to edge along height axis) */
  halfHeight: number;
  /** Cosine of the box rotation angle */
  cosAngle: number;
  /** Sine of the box rotation angle */
  sinAngle: number;
}

/**
 * Represents a projection of points onto an axis for SAT collision detection.
 * Used to determine if two shapes overlap on a particular axis.
 */
interface Projection {
  /** Minimum value of the projection */
  min: number;
  /** Maximum value of the projection */
  max: number;
}

/**
 * Represents a 2D point with x and y coordinates.
 */
interface Point2D {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
}

/**
 * Represents a 2D collision axis vector for SAT collision detection.
 */
interface CollisionAxis {
  /** X component of the axis vector */
  x: number;
  /** Y component of the axis vector */
  y: number;
}

/**
 * Defines a corner of an oriented bounding box relative to its center.
 * Used to systematically calculate all four corners of an OBB.
 */
interface CornerDefinition {
  /** Sign multiplier for width direction (+1 or -1) */
  widthSign: number;
  /** Sign multiplier for height direction (+1 or -1) */
  heightSign: number;
  /** Human-readable description of the corner position */
  description: string;
}

/**
 * Advanced collision detection system using Oriented Bounding Boxes (OBB) and Separating Axis Theorem (SAT).
 * Provides accurate collision detection for rotated sprites and handles both obstacle and item collisions.
 */
class CollisionDetector {
  // Define the four corners of an OBB in a structured way
  private readonly CORNER_DEFINITIONS: CornerDefinition[] = [
    { widthSign: 1, heightSign: 1, description: "top-right (+width, +height)" },
    { widthSign: -1, heightSign: 1, description: "top-left (-width, +height)" },
    { widthSign: -1, heightSign: -1, description: "bottom-left (-width, -height)" },
    { widthSign: 1, heightSign: -1, description: "bottom-right (+width, -height)" }
  ];

  /**
   * Gets the visual bounds of a Phaser game object.
   * @param obj - The game object to get bounds for
   * @returns Rectangle bounds or null if bounds cannot be determined
   */
  private getVisualBounds(obj: any): Phaser.Geom.Rectangle | null {
    if (obj && typeof obj.getBounds === 'function') {
      return obj.getBounds() as Phaser.Geom.Rectangle;
    }
    return null;
  }

  /**
   * Shrinks a rectangle by a given factor while maintaining its center.
   * @param rect - The original rectangle
   * @param shrinkFactor - Factor to shrink by (0.8 = 80% of original size)
   * @returns New shrunken rectangle
   */
  private shrinkRectangle(rect: Phaser.Geom.Rectangle, shrinkFactor = 0.8): Phaser.Geom.Rectangle {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const newWidth = rect.width * shrinkFactor;
    const newHeight = rect.height * shrinkFactor;
    return new Phaser.Geom.Rectangle(
      centerX - newWidth / 2,
      centerY - newHeight / 2,
      newWidth,
      newHeight
    );
  }

  /**
   * Creates an oriented bounding box from a Phaser sprite.
   * Handles rotation, collision data, and size calculations.
   * @param sprite - The sprite to create OBB for
   * @returns OrientedBoundingBox or null if creation fails
   */
  private createOrientedBoundingBox(sprite: any): OrientedBoundingBox | null {
    if (sprite && typeof sprite.getData === "function") {
      const isCollidable = sprite.getData("collidable");
      if (isCollidable === false) return null;
    }

    if (!sprite) return null;

    const displayWidth = sprite.displayWidth ?? sprite.width;
    const displayHeight = sprite.displayHeight ?? sprite.height;

    if (!displayWidth || !displayHeight) return null;

    // Base collision footprint
    let collisionWidth = displayWidth * OBST_COLLIDE_WIDTH_FRAC;
    let collisionHeight = displayHeight * OBST_COLLIDE_HEIGHT_FRAC;

    // Increase height by 80%
    collisionHeight = collisionHeight * 1.8;

    // Apply global shrink
    collisionWidth *= HITBOX_GLOBAL_SHRINK;
    collisionHeight *= HITBOX_GLOBAL_SHRINK;

    const halfWidth = collisionWidth / 2;
    const halfHeight = collisionHeight / 2;

    // Rotation in radians
    const angleRadians = ((sprite.angle as number) || 0) * Math.PI / 180;
    const cosAngle = Math.cos(angleRadians);
    const sinAngle = Math.sin(angleRadians);

    // Position center using local offset rotated into world space
    const localYAxisX = -sinAngle;
    const localYAxisY = cosAngle;
    const verticalOffset = halfHeight + 0.2 * collisionHeight;

    const centerX = (sprite.x as number) - localYAxisX * verticalOffset;
    const centerY = (sprite.y as number) - localYAxisY * verticalOffset;

    return {
      centerX,
      centerY,
      halfWidth,
      halfHeight,
      cosAngle,
      sinAngle
    };
  }

  /**
   * Converts a Phaser rectangle to an oriented bounding box (axis-aligned).
   * @param rect - The rectangle to convert
   * @returns OrientedBoundingBox representation
   */
  private rectangleToOrientedBoundingBox(rect: Phaser.Geom.Rectangle): OrientedBoundingBox {
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    return {
      centerX,
      centerY,
      halfWidth: rect.width / 2,
      halfHeight: rect.height / 2,
      cosAngle: 1,
      sinAngle: 0
    };
  }

  /**
   * Gets the collision axes for an oriented bounding box.
   * Returns the two perpendicular axes that define the OBB orientation.
   * @param obb - The oriented bounding box
   * @returns Array of two collision axes
   */
  private getOrientedBoundingBoxAxes(obb: OrientedBoundingBox): CollisionAxis[] {
    return [
      { x: obb.cosAngle, y: obb.sinAngle },
      { x: -obb.sinAngle, y: obb.cosAngle }
    ];
  }

  /**
   * Calculates all four corners of an oriented bounding box.
   * @param obb - The oriented bounding box
   * @returns Array of four corner points
   */
  private getOrientedBoundingBoxCorners(obb: OrientedBoundingBox): Point2D[] {
    const { centerX, centerY, halfWidth, halfHeight, cosAngle, sinAngle } = obb;

    // Unit vectors for the OBB axes
    const widthAxisX = cosAngle;
    const widthAxisY = sinAngle;
    const heightAxisX = -sinAngle;
    const heightAxisY = cosAngle;

    // Calculate each corner using the structured definitions
    return this.CORNER_DEFINITIONS.map(cornerDef => ({
      x: centerX +
         cornerDef.widthSign * widthAxisX * halfWidth +
         cornerDef.heightSign * heightAxisX * halfHeight,
      y: centerY +
         cornerDef.widthSign * widthAxisY * halfWidth +
         cornerDef.heightSign * heightAxisY * halfHeight
    }));
  }

  /**
   * Projects a polygon onto an axis for SAT collision detection.
   * @param axis - The axis to project onto
   * @param points - The polygon points to project
   * @returns Projection with min and max values
   */
  private projectPolygonOntoAxis(axis: CollisionAxis, points: Point2D[]): Projection {
    let min = axis.x * points[0].x + axis.y * points[0].y;
    let max = min;

    for (let i = 1; i < points.length; i++) {
      const projection = axis.x * points[i].x + axis.y * points[i].y;
      if (projection < min) min = projection;
      if (projection > max) max = projection;
    }

    return { min, max };
  }

  /**
   * Checks if two projections overlap on an axis.
   * @param projectionA - First projection
   * @param projectionB - Second projection
   * @returns True if projections overlap, false otherwise
   */
  private projectionsOverlap(projectionA: Projection, projectionB: Projection): boolean {
    return projectionA.max >= projectionB.min && projectionB.max >= projectionA.min;
  }

  /**
   * Checks if two oriented bounding boxes intersect using SAT.
   * @param obbA - First oriented bounding box
   * @param obbB - Second oriented bounding box
   * @returns True if boxes intersect, false otherwise
   */
  private orientedBoundingBoxesIntersect(obbA: OrientedBoundingBox, obbB: OrientedBoundingBox): boolean {
    const axes = [...this.getOrientedBoundingBoxAxes(obbA), ...this.getOrientedBoundingBoxAxes(obbB)];
    const cornersA = this.getOrientedBoundingBoxCorners(obbA);
    const cornersB = this.getOrientedBoundingBoxCorners(obbB);

    for (const axis of axes) {
      const projectionA = this.projectPolygonOntoAxis(axis, cornersA);
      const projectionB = this.projectPolygonOntoAxis(axis, cornersB);

      if (!this.projectionsOverlap(projectionA, projectionB)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks for collisions between a player and obstacles using OBB collision detection.
   * @param player - The player object (Rectangle or Sprite)
   * @param obstacles - Group of obstacle sprites
   * @param onHit - Callback function called when collision is detected
   */
  checkObstacleCollision(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    obstacles: Phaser.GameObjects.Group,
    onHit: (obstacle: Phaser.GameObjects.Sprite) => void
  ): void {
    const playerBounds = this.getVisualBounds(player as any);
    if (!playerBounds) return;

    const playerRect = this.shrinkRectangle(playerBounds, COLLIDE_SHRINK_PLAYER * HITBOX_GLOBAL_SHRINK);
    const playerOBB = this.rectangleToOrientedBoundingBox(playerRect);

    obstacles.children.each((obstacle) => {
      const obstacleOBB = this.createOrientedBoundingBox(obstacle as any);
      if (!obstacleOBB) return true;

      if (this.orientedBoundingBoxesIntersect(playerOBB, obstacleOBB)) {
        onHit(obstacle as any);
        return false;
      }

      return true;
    });
  }

  /**
   * Checks for collisions between a player and collectible items using AABB collision detection.
   * @param player - The player object (Rectangle or Sprite)
   * @param items - Group of item rectangles
   * @param onCollect - Callback function called when item is collected
   */
  checkItemCollisions(
    player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
    items: Phaser.GameObjects.Group,
    onCollect: (item: Phaser.GameObjects.Rectangle) => void
  ): void {
    let collectedItem: Phaser.GameObjects.Rectangle | null = null;

    const playerBounds = this.getVisualBounds(player as any);
    if (!playerBounds) return;

    const playerRect = this.shrinkRectangle(playerBounds, COLLIDE_SHRINK_PLAYER * HITBOX_GLOBAL_SHRINK);

    items.children.each((item) => {
      const itemBounds = this.getVisualBounds(item as any);
      if (!itemBounds) return true;

      const itemRect = this.shrinkRectangle(itemBounds, COLLIDE_SHRINK_ITEM * HITBOX_GLOBAL_SHRINK);

      if (Phaser.Geom.Intersects.RectangleToRectangle(playerRect, itemRect)) {
        collectedItem = item as any;
        return false;
      }

      return true;
    });

    if (collectedItem) {
      onCollect(collectedItem);
    }
  }
}

// Create a singleton instance for backward compatibility
const collisionDetector = new CollisionDetector();

// Export the functions for backward compatibility
/**
 * Checks for collisions between a player and obstacles (legacy function for backward compatibility)
 * @deprecated Use CollisionDetector.checkObstacleCollision() instead for better control
 * @param player - The player object
 * @param obstacles - Group of obstacle sprites
 * @param onHit - Callback function called when collision is detected
 */
export function checkObstacleCollision(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  obstacles: Phaser.GameObjects.Group,
  onHit: (obstacle: Phaser.GameObjects.Sprite) => void
): void {
  collisionDetector.checkObstacleCollision(player, obstacles, onHit);
}

/**
 * Checks for collisions between a player and collectible items (legacy function for backward compatibility)
 * @deprecated Use CollisionDetector.checkItemCollisions() instead for better control
 * @param player - The player object
 * @param items - Group of item rectangles
 * @param onCollect - Callback function called when item is collected
 */
export function checkItemCollisions(
  player: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Sprite,
  items: Phaser.GameObjects.Group,
  onCollect: (item: Phaser.GameObjects.Rectangle) => void
): void {
  collisionDetector.checkItemCollisions(player, items, onCollect);
}

// Export the class for advanced usage
export { CollisionDetector };
