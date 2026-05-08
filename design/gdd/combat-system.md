# 战斗系统 (Combat System)

---
**Status**: Reverse-Documented
**Source**: `public/game.js` — combat, projectile, monster systems
**Last Updated**: 2026-05-08
**Layer**: Core · **Priority**: MVP
**Key deps**: Movement, Collision, Heroes, Wave
---

## Summary

自动索敌攻击系统。玩家附近有怪时自动向最近目标发射弹道，弹道命中造成伤害。怪物接触玩家造成接触伤害。Boss/精英有特殊技能。

## Overview

玩家不用手动瞄准——游戏自动检测范围内最近的怪物，以固定冷却时间发射弹道。不同英雄的弹道速度、伤害、射程不同。修仙大仙有概率额外发射追踪飞剑。

## Player Fantasy

站桩输出、清屏快感。玩家专注于走位躲避，攻击自动完成。高攻速和范围效果带来"割草"体验。

## Detailed Design

### 核心规则

1. 每帧检测玩家 `ATTACK_RANGE` 内最近活怪
2. 若 `attackCooldown` 计时器归零 → 发射弹道 `Projectile`
3. 弹道以 `projectileSpeed` 飞向怪物当前位置（非追踪，除飞剑外）
4. 弹道命中后计算伤害：`damage = random(min, max) + bonuses - monster.defense`
5. 伤害显示浮动文字，粒子爆发
6. 怪物 HP ≤ 0 → 死亡、掉落、加分

### 冷却时间

| 英雄 | 基础冷却 | 受卡牌/装备影响 |
|------|---------|---------------|
| 修仙大仙 | 550ms | ✅ |
| 忍术忍者 | 500ms | ✅ |
| 超能力者 | 650ms | ✅ |

### 飞剑追击 (修仙大仙)

- 触发概率: 30%
- 自动追踪最近活怪（非当前目标也可）
- 伤害 = 基础伤害 × 0.5 + 修仙飞剑伤害加成
- 速度: 1200px/s

### 弹道类型

| 属性 | 修仙大仙 | 忍术忍者 | 超能力者 |
|------|---------|---------|---------|
| 射程 | 190px | 140px | 220px |
| 速度 | 900px/s | 1000px/s | 700px/s |
| 伤害 | 12-20 | 18-28 | 10-16 |
| 弹道尺寸 | 9px | 7px | 11px |
| 颜色 | #00d4ff | #ff4757 | #a855f7 |

### 冰霜效果

冰系技能可附加 `iceEffect` 到弹道，命中后减速怪物。

## 怪物系统

### 基本属性

```js
{
  hp: baseHp * waveMultiplier,
  speed: baseSpeed * waveMultiplier,
  contactDmg: 8,
  size: 16-24,
  goldReward: 10-15 + wave*2
}
```

### 怪物类型

| 类型 | 特征 |
|------|------|
| 普通 | 向玩家直线移动 |
| 精英 | 2倍HP、更快、特殊弹道/技能 |
| Boss | 5倍HP、大尺寸、多阶段技能 |

### 波次缩放

- HP: ×1.15^(wave-1)
- 速度: ×1.05^(wave-1)
- 数量: 3 + (wave-1)×2

## 伤害公式

```
finalDamage = max(1, random(hero.attackMin, hero.attackMax) + bonuses - monsterDefense)
```

护盾吸收:
```
if player.shield > 0:
    absorbed = min(shield, incomingDamage)
    shield -= absorbed
    incomingDamage -= absorbed
```

## 数值平衡

| 参数 | 当前值 | 安全范围 | 说明 |
|------|--------|---------|------|
| 基础伤害 | 12-28 | 8-35 | 按英雄不同 |
| 攻击冷却 | 500-650ms | 400-800ms | |
| 攻击范围 | 140-220px | 120-280px | |
| 波次HP倍率 | 1.15 | 1.08-1.20 | |
| 接触伤害 | 8 | 5-15 | |
| 接触间隔 | 600ms | 400-800ms | 免伤间隔 |

## 视觉/音效

| 事件 | 视觉 | 音效 |
|------|------|------|
| 发射弹道 | 弹道粒子尾迹 | 400Hz square 0.12s |
| 命中怪物 | 爆炸粒子 + 浮动伤害数字 | 200Hz sawtooth 0.12s |
| 击杀怪物 | 死亡粒子爆发 + 金币飞行 | 600Hz square 0.15s |

## Open Questions

| 问题 | 状态 |
|------|------|
| 是否需要手动瞄准模式？ | 未决定 |
| PvP 多人对战？ | 远期计划 |
