# KnutGame - Christmas-Themed 2D Game

A festive 2D game built with ASP.NET Core 9 backend and Phaser 3 frontend, featuring a Christmas theme with falling obstacles and player movement.

## Project Structure

```
KnutGame/
├── src/
│   ├── KnutGame.Client/     # Vite + TypeScript + Phaser frontend
│   └── KnutGame.Server/     # ASP.NET Core 9 backend with Razor Pages
├── docs/                    # Project documentation
└── README.md
```

## Current Status

### ✅ Completed Iterations

**Iteration 0: Foundation** (Skipped - existing repo)
- Repo setup, toolchain, CI basics

**Iteration 1: Game Shell**
- Embedded client build in ASP.NET Core
- Clean HTML output without template elements
- Responsive design with mobile support

**Iteration 2: Phaser Setup + Player Movement**
- Phaser 3 integration with TypeScript
- Green rectangle player with physics
- Keyboard (WASD/arrows) and touch controls
- FPS counter and auto-pause functionality
- Responsive sizing (800px desktop, full screen mobile)
- Build optimization (1.48 MB bundle, within budget)

**Iteration 3: Obstacles & Collision System**
- Falling Christmas tree obstacles with random positioning
- Collision detection and lives system (♥♥♥)
- Progressive difficulty with increasing spawn rates
- Game over state with restart functionality
- Score system (10 points/second survived)
- Object pooling to prevent memory leaks
- Invulnerability frames after collision

### 🚧 Next: Iteration 4 - Items & Scoring + Local Highscore

**Planned Features:**
- Falling Christmas trees as obstacles
- Collision detection system
- Lives system and game over mechanics
- Progressive difficulty with spawn rate increases
- Score tracking and display

## Tech Stack

- **Backend**: ASP.NET Core 9 (Razor Pages)
- **Frontend**: Phaser 3 (TypeScript), Vite build system
- **Styling**: CSS with responsive design
- **Build**: Vite with custom output paths
- **Version Control**: Git with comprehensive .gitignore

## Development Setup

1. **Prerequisites**
   - .NET 9 SDK
   - Node.js 18+
   - Git

2. **Clone and Setup**
   ```bash
   git clone <repository-url>
   cd KnutGame
   ```

3. **Client Setup**
   ```bash
   cd src/KnutGame.Client
   npm install
   npm run build
   ```

4. **Server Setup**
   ```bash
   cd src/KnutGame.Server
   dotnet restore
   dotnet build
   ```

5. **Run Development**
   ```bash
   # From src/KnutGame.Server directory
   dotnet run
   ```

   Server will start on `https://localhost:7104` (or configured port)

## Game Controls

- **Desktop**: WASD or Arrow Keys to move left/right
- **Mobile**: Touch left/right screen halves
- **Restart**: Click "Click to Restart" button or press SPACE after game over
- **Auto-pause**: Game pauses when tab loses focus

## Game Mechanics

- **Objective**: Dodge falling Christmas trees as long as possible
- **Lives**: Start with 3 lives (♥), lose one on collision
- **Invulnerability**: 1 second of invulnerability after being hit (player turns red)
- **Scoring**: 10 points per second survived
- **Difficulty**: Spawn rate increases over time (2s to 0.8s intervals)
- **Game Over**: When all lives are lost, click to restart

## Build & Deployment

- Client builds to `src/KnutGame.Server/wwwroot/game/`
- ASP.NET Core serves static assets and Razor Pages
- Production build optimized for performance

## Project Goals

Create an engaging Christmas-themed game with:
- Smooth 60 FPS gameplay
- Responsive design for all devices
- Progressive difficulty
- Clean, festive visual design
- Optimized build size and performance
