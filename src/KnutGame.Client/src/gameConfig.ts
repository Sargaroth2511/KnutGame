export const MOVE_SPEED = 200;
export const FALL_SPEED_MIN = 150;
export const FALL_SPEED_MAX = 250;
export const INVULNERABILITY_MS = 1000;
export const SPAWN_INTERVAL_START = 2000;
export const SPAWN_INTERVAL_MIN = 800;
export const SPAWN_INTERVAL_DECAY = 10;

// Iteration 4 constants (adjusted in Iteration 8: no passive time scoring)
export const BASE_POINTS_PER_SEC = 0;
export const MULTIPLIER_X = 2;
export const MULTIPLIER_MS = 7000; // 7s
export const SLOWMO_FACTOR = 0.5; // 50%
export const SLOWMO_MS = 5000; // 5s
export const LIFE_MAX = 5;
export const POINTS_ITEM_BONUS = 100;
export const ITEM_SPAWN_INTERVAL_MS = 2500;
export const ITEM_DROP_CHANCE = 0.35; // 35% on spawn tick

// Iteration 8 constants (visuals/physics-like)
export const TOPPLE_DURATION_MS = 750; // rotation/slide time
export const TOPPLE_BLOCK_MS = 2500;   // ground block duration
export const ITEM_GROUND_MS = 2000;    // item linger duration
export const MAX_OBSTACLES = 20;
export const MAX_TOPPLED = 6;
export const MAX_ITEMS_AIR = 12;
export const MAX_ITEMS_GROUND = 8;
export const MAX_PARTICLES = 80;

// Iteration 8: decouple coin vs powerup spawn
export const COIN_SPAWN_INTERVAL_MS = 900;   // coins spawn more frequently
export const COIN_DROP_CHANCE = 0.42;        // 30% less frequent than before
export const POWERUP_SPAWN_INTERVAL_MS = 2600; // life/slowmo/multi
export const POWERUP_DROP_CHANCE = 0.35;

// Display sizing
export const PLAYER_SIZE = 64; // target size of player avatar (pixels, max dimension)
export const ITEM_SIZE = 64;   // target size of item sprites (pixels, max dimension)

// Iteration 9 dynamics
export const DYNAMICS_ENABLED = true;
export const OBSTACLE_VX_MIN = -40;  // px/s
export const OBSTACLE_VX_MAX =  40;  // px/s
// Allow free rotation; tune speed for readability
export const OBSTACLE_OMEGA_MIN = -60; // deg/s
export const OBSTACLE_OMEGA_MAX =  60; // deg/s
export const OBSTACLE_SWAY_AMP = 12;   // px
export const OBSTACLE_SWAY_FREQ = 0.7; // Hz
export const COLLIDE_SHRINK_PLAYER = 0.85;
export const COLLIDE_SHRINK_OBST = 0.8;
export const COLLIDE_SHRINK_ITEM = 0.8;
// Global fine-tune to shrink all hitboxes a bit more (visual + logic)
export const HITBOX_GLOBAL_SHRINK = 0.95; // 5% smaller
// Obstacle collision footprint (relative to visible sprite, anchored at bottom)
export const OBST_COLLIDE_WIDTH_FRAC = 0.7;  // 70% of visible width
export const OBST_COLLIDE_HEIGHT_FRAC = 0.4; // bottom 40% acts as solid trunk
