namespace KnutGame.Game;

public static class GameConfig
{
    public const int MOVE_SPEED = 200;
    public const int FALL_SPEED_MIN = 150;
    public const int FALL_SPEED_MAX = 250;
    public const int INVULNERABILITY_MS = 1000;
    public const int SPAWN_INTERVAL_START = 2000;
    public const int SPAWN_INTERVAL_MIN = 800;
    public const int SPAWN_INTERVAL_DECAY = 10;

    // Iteration 4 constants
    public const int BASE_POINTS_PER_SEC = 10;
    public const int MULTIPLIER_X = 2;
    public const int MULTIPLIER_MS = 7000; // 7s
    public const float SLOWMO_FACTOR = 0.5f; // 50%
    public const int SLOWMO_MS = 5000; // 5s
    public const int LIFE_MAX = 5;
    public const int POINTS_ITEM_BONUS = 100;
    public const int ITEM_SPAWN_INTERVAL_MS = 2500;
    public const float ITEM_DROP_CHANCE = 0.35f; // 35% on spawn tick
}
