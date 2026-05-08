# ADR-002: 全局状态管理 — 单一 gameState 对象

**状态**: Accepted  
**日期**: 项目初期  
**决策者**: 开发者

## 背景

游戏有 12+ 子系统（波次、战斗、掉落、修仙、AI…），需要共享大量状态。需要决定状态管理架构。

## 决定

**使用单一全局 `gameState` 对象管理所有游戏状态。**

```js
const gameState = {
    player: { x, y, hp, mp, ... },
    monsters: [],
    projectiles: [],
    particles: [],
    currentPath: [],
    wave: 1,
    gold: 0,
    ...
};
```

## 理由

| 因素 | 分析 |
|------|------|
| 简单 | 任何函数直接访问 `gameState.xxx`，零样板代码 |
| 调试 | `console.log(gameState)` 一键查看全部状态 |
| 序列化 | `JSON.stringify(gameState)` 即存档 |
| 项目规模 | 单文件游戏，不涉及多页面/路由 |

## 后果

- ✅ 开发体验极好，`gameState.xxx` 随处可用
- ✅ 存档/读档一行代码
- ❌ 全局命名污染（任何函数可修改任何状态）
- ❌ 难以单元测试（需注入 mock state）
- ❌ 并发风险（AI Bot 和玩家可能同时修改状态）

## 缓解措施

- 拆分模块后保持 `gameState` 为唯一共享状态
- 关键状态变更通过命名约定区分（`_private` 前缀表示内部状态）
- AI Bot 通过 `gameState.aiEnabled` 开关控制

## 替代方案

| 方案 | 为什么不选 |
|------|-----------|
| Redux/状态管理库 | 增加依赖，过度设计 |
| ECS 架构 | 对简单 2D 游戏过度工程 |
| 观察者模式 | 增加样板，对 JS 不自然 |
