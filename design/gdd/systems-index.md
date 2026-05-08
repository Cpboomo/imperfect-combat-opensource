# 系统索引 (Systems Index)

> **用途**: `/design-system` 和 `/map-systems` 的导航文件
> **优先级**: MVP → Vertical Slice → Alpha → Full Vision

| # | 系统名 | 层级 | 优先级 | 状态 | GDD |
|---|--------|------|--------|------|-----|
| 1 | 波次系统 (Wave) | Foundation | MVP | ✅ 已实现 | `wave-system.md` |
| 2 | 战斗系统 (Combat) | Core | MVP | ✅ 已实现 | `combat-system.md` |
| 3 | 角色系统 (Heroes) | Core | MVP | ✅ 已实现 | `hero-system.md` |
| 4 | 寻路移动 (Movement) | Foundation | MVP | ✅ 已实现 | `movement-system.md` |
| 5 | 装备掉落 (Loot) | Core | Vertical Slice | ✅ 已实现 | `loot-system.md` |
| 6 | 卡牌系统 (Cards) | Feature | Alpha | ✅ 已实现 | `card-system.md` |
| 7 | 修仙系统 (Cultivation) | Feature | Full Vision | ✅ 已实现 | `cultivation-system.md` |
| 8 | 音效系统 (Audio) | Presentation | MVP | ✅ 已实现 | — |
| 9 | 粒子系统 (Particles) | Presentation | Alpha | ✅ 已实现 | — |
| 10 | AI Bot | Feature | Full Vision | ✅ 已实现 | `ai-bot.md` |
| 11 | 关卡编辑器 (Editor) | Tools | Full Vision | ✅ 已实现 | `editor-system.md` |
| 12 | 商店系统 (Shop) | Feature | Alpha | ✅ 已实现 | `shop-system.md` |

## 依赖关系图

```
Foundation (底层):
  Movement ← A* Pathfinding
  Collision Detection
  
Core (核心):
  Combat → depends on: Movement, Collision, Heroes
  Heroes → depends on: Combat
  Wave → depends on: Combat, Heroes
  
Feature (特性):
  Loot → depends on: Wave, Combat
  Cards → depends on: Wave
  Cultivation → depends on: Heroes (修仙大仙专属)
  Shop → depends on: Loot
  AI Bot → depends on: All core systems
  
Presentation (表现):
  Audio, Particles → depends on: Combat
  
Tools (工具):
  Editor → depends on: All systems
```
