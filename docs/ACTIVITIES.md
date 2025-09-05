# Project Activities Log

This file tracks the activities and changes made to the KnutGame project.

## September 5, 2025

### Project Examination
- Examined the project structure consisting of a .NET 9 ASP.NET Core server and a Vite/TypeScript client with Phaser.
- Identified several reference issues preventing the build from succeeding.

### Issues Found
1. **ViteManifestService Reference Error**: The `ViteManifestService.cs` file was located outside the project directory (`Server/KnutGame/Services/`), causing a build error: "The type or namespace name 'Services' does not exist in the namespace 'KnutGame'".
2. **Incorrect Vite Build Output Path**: The `vite.config.ts` had `outDir: '../Server/wwwroot/game'`, which resolved to the wrong location. The correct path should be `Server/KnutGame/KnutGame/wwwroot/game`.
3. **Missing Using Directive**: `ViteManifestService.cs` was missing `using System.Text.Json;` for `JsonSerializer` and `JsonSerializerOptions`.

### Fixes Applied
1. **Moved Service File**: Relocated `ViteManifestService.cs` from `Server/KnutGame/Services/` to `Server/KnutGame/KnutGame/Services/` to include it in the project build.
2. **Updated Vite Configuration**: Changed `vite.config.ts` `outDir` to use an absolute path: `c:/Source/KnutGame/Server/KnutGame/KnutGame/wwwroot/game`.
3. **Added Missing Using**: Added `using System.Text.Json;` to `ViteManifestService.cs`.
4. **Created Output Directory**: Manually created `wwwroot/game` folder since Vite requires it to exist when `emptyOutDir` is true.
5. **Cleanup**: Removed the now-empty `Services` folder outside the project.

### Verification
- **Server Build**: `dotnet build` now succeeds without errors.
- **Client Build**: `npm run build` correctly outputs assets to `wwwroot/game`, including the required `manifest.json`.
- **Asset Integration**: The server can now properly serve the built client assets through the configured static file middleware and `ViteManifestService`.

### Current Status
The project builds successfully and is ready for development and deployment. The client assets are correctly integrated with the server for proper serving.

## September 5, 2025 (Continued)

### Git Setup and Line Ending Fixes
- **Issue**: Git warning about LF/CRLF line ending conversion in `Client/tsconfig.json`
- **Solution**: Created `.gitattributes` file to normalize line endings:
  - JSON files: LF (Unix line endings)
  - Markdown files: LF
  - YAML files: LF
  - Other text files: Auto-normalization
- **Additional Setup**:
  - Created comprehensive `.gitignore` to exclude Visual Studio files, build outputs, and common artifacts
  - Excluded `.vs/` directory from Git tracking
  - Committed all project files with proper line ending normalization
- **Result**: Line ending warnings resolved, consistent file formats across the repository

### Client Code Cleanup
- **Removed Template Files**:
  - Deleted `counter.ts` (template counter component)
  - Deleted `typescript.svg` (template asset)
- **Cleaned Up Core Files**:
  - `main.ts`: Replaced template HTML/JS with minimal game initialization
  - `style.css`: Simplified from template styles to basic game layout
  - `index.html`: Updated title to "Knut Game" and removed vite.svg reference
- **Kept Essential Files**:
  - `vite-env.d.ts` (required for Vite TypeScript integration)
- **Verification**: Client builds successfully with cleaned code (reduced bundle size)

### Iteration 1: Game Shell in Razor Pages + Embedded Client Build
- **Index.cshtml Updated**: Replaced default ASP.NET template with game container and asset loading
- **Asset Loading**: Configured to load built CSS and JS from `/game/assets/` with proper caching
- **Server Configuration**: Static files serving already configured with 7-day cache for game assets
- **Build Integration**: Vite configured to output to correct server location

### Iteration 3: Obstacles & Collision System
- **Obstacle Spawning**: Implemented falling Christmas tree obstacles with random X-position
- **Variable Fall Speed**: Obstacles fall at 150-250 pixels/second with randomization
- **Progressive Difficulty**: Spawn interval decreases from 2s to 0.8s over time
- **Collision Detection**: AABB collision between player and obstacles using Phaser.Geom.Intersects
- **Lives System**: 3 lives with ♥ display, reduces on collision
- **Invulnerability Frames**: 1-second invulnerability after hit with visual feedback (red player)
- **Game Over State**: Pause physics, display "GAME OVER" and restart button
- **Restart Functionality**: Click restart button or press SPACE to restart
- **Score System**: Points per second survived (10 points/second)
- **Timer Display**: Real-time survival timer in top-left
- **Object Pooling**: Reuse obstacle objects to prevent memory leaks
- **UI Updates**: Lives (♥♥♥), timer, score display with proper z-index layering
- **Game State Management**: Proper reset of all game variables on restart
- **Build Size**: Maintained 1.48 MB bundle within performance budget
