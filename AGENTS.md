# ddz — 像素风格斗地主

## 项目概览

纯前端单页应用，斗地主（Doudizhu）纸牌游戏，单机 / 联机双模式融合在单一文件：

| 文件 | 内容 |
|---|---|
| `index.html` | 完整应用，含单机 vs AI + P2P联机（约2100行） |
| `sw.js` | Service Worker，离线缓存 |
| `manifest.json` | PWA 清单 |

无构建工具、无包管理器、无测试、无 lint。直接浏览器打开即可运行。

## 关键事实

- **运行方式**：打开 `index.html` 到浏览器；或 `python3 -m http.server 8080` 后访问
- **CDN依赖（需联网）**：Tailwind CSS、Google Fonts Press Start 2P、PeerJS（联机模式）
- **数据持久化**：`localStorage` key `landlord_stats`（战绩/金币/统计），非 IndexedDB
- **前端架构**：纯内联 HTML+CSS+JS，零框架，无模块系统
- **音效**：Web Audio API 合成（`playSound` 函数），无需音频文件
- **语音播报**：`speechSynthesis` API，中文语音（仅单机模式）
- **触摸优化**：禁用双击缩放、阻止非手牌区域滚动、`touch-action: manipulation`

## 双模式架构

开始画面选择模式：

- **单机模式**：AI 对手（`MasterAI` 类），含记牌器（`MasterMemory` 类），三级难度（easy/medium/hard）
- **联机模式**：PeerJS P2P，房主+2客户端，全状态同步，断线AI托管（easy难度），10秒倒计时

模式由 `GameState.mode`（`'single'` / `'online'`）区分。

## 架构要点

- **AI 引擎**：`MasterAI.think(phase, state)` — `phase='call'` 返回分数，`phase='play'` 返回出牌数组
- **记牌器**：`MasterMemory` 跟踪剩余牌分布、历史出牌、炸弹可能性
- **牌型识别**：`getCardType(cards)` 返回 `{type, value, cards}`；`canBeat(current, last)` 比较大小
- **出牌生成**：`getAllValidPlays(hand, lastPlay)` 穷举所有合法牌型（仅单机模式）
- **牌值编码**：3→0, 4→1, ..., A→11, 2→12, 小王→13, 大王→14
- **花色**：`♠♥♣♦` + `JOKER`
- **GameState 对象**：全局状态（含 `mode`, `myIndex`, `myRole`, `peer`, `connections`, `callScores` 等）
- **状态同步**：联机模式 `broadcastFullState()` / `handleSync()`，房主持有权威状态，按连接顺序分配玩家索引（1, 2）
- **Service Worker**：sw.js 根据自身路径自动确定作用域（`BASE_PATH`），支持 GitHub Pages 多项目部署

## 操作提示

- 修改后直接刷新浏览器验证，无验证工具链
- 全部内联（CSS + HTML + JS 在同一文件），编辑时注意各段范围
- 牌型枚举定义在 `CardType` 常量对象
- 联机叫分/出牌均 10 秒超时，超时自动弃权
- 掉线玩家由 easy 难度 AI 自动托管，对局继续
- **提交到 GitHub 规则**：
  - `index.html` 每次变更提交时，必须同时升版 `sw.js` 中的 `CACHE_NAME` 版本号（如 `v7→v8`）并一起提交
  - `sw.js` 永远与 `index.html` 成对提交，不可单独提交一方
