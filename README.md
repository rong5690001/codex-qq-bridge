# codex-qq-bridge

`codex-qq-bridge` 是一个本机守护进程，用来把 Hermes Agent 收到的 QQ 消息转发给本机 Codex 执行，并把执行结果通过 Hermes 回发到 QQ。

它的核心目标是：

```text
QQ 消息 → Hermes MCP → codex-qq-bridge → Codex SDK thread → Hermes MCP → QQ 回复
```

第一版只支持 Codex 后端，不支持 Claude。

## 功能特性

- 监听 Hermes MCP 消息事件。
- 支持 QQ 白名单用户/群组控制。
- 使用 `@openai/codex-sdk@0.128.0` 调用本机 Codex。
- 支持 Codex `startThread()` / `resumeThread()` 长会话。
- 每个项目绑定一个 Codex `threadId`。
- `threadId` 存储在本地状态文件中，可与 Codex App/CLI 底层 `~/.codex/sessions` 会话存储共享。
- 支持项目级运行锁，避免同一项目并发执行多个 Codex 任务。
- 拦截明显危险请求，例如 `sudo`、`rm -rf /`、读取 `.env`、输出 token/API key/password。
- 每次运行保存日志到 `runs/<runId>/`。

## 工作原理

```text
QQ 私聊/群消息
  ↓
Hermes Agent QQ 适配器
  ↓
Hermes MCP Server: hermes mcp serve
  ↓
codex-qq-bridge
  ↓
@openai/codex-sdk
  ↓
本机 Codex exec / ~/.codex/sessions
  ↓
Hermes messages_send 回发 QQ
```

Codex SDK 底层会启动本机 Codex 执行进程，因此它不是完全独立的云 API 调用。它会复用本机 Codex 的认证和基础会话存储。

## 环境要求

- Node.js 24 或更高版本。
- npm。
- 本机已安装并登录 Codex。
- 本机可运行 `hermes mcp serve`。
- Hermes Agent 已经能收到 QQ 消息。

检查 Codex：

```bash
codex --version
codex login
```

检查 Hermes：

```bash
hermes mcp serve
```

## 安装

```bash
cd /Users/rong/workspace/codex-qq-bridge
npm install
```

## 配置

复制示例配置：

```bash
cp config.example.json config.json
```

编辑：

```bash
vim config.json
```

默认配置示例：

```json
{
  "hermes": { "command": "hermes", "args": ["mcp", "serve"] },
  "allowedUsers": ["<你的QQ号>"],
  "allowedGroups": [],
  "commandPrefix": "cx",
  "defaultProject": "doudou-puzzle",
  "allowDirectPrivateMessage": false,
  "defaultSandbox": "workspace-write",
  "defaultReasoningEffort": "medium",
  "replyMaxChars": 3500,
  "projects": {
    "doudou-puzzle": {
      "cwd": "/Users/rong/workspace/doudou-puzzle",
      "threadId": "",
      "sharedWithCodexApp": true
    }
  }
}
```

### 字段说明

| 字段 | 说明 |
| --- | --- |
| `hermes.command` | Hermes MCP Server 启动命令。 |
| `hermes.args` | Hermes MCP Server 启动参数。 |
| `allowedUsers` | 允许触发 Codex 的 QQ 用户 ID。 |
| `allowedGroups` | 允许触发 Codex 的 QQ 群 ID。 |
| `commandPrefix` | QQ 指令前缀，默认 `cx`。 |
| `defaultProject` | 可选。省略项目名时使用的默认项目别名，必须存在于 `projects`。 |
| `allowDirectPrivateMessage` | 是否允许白名单用户私聊免前缀直接发任务，默认 `false`。 |
| `defaultSandbox` | Codex sandbox，当前固定为 `workspace-write`。 |
| `defaultReasoningEffort` | Codex 推理强度：`low`、`medium`、`high`、`xhigh`。 |
| `replyMaxChars` | QQ 单次回复最大字符数，超出会截断。 |
| `projects` | 项目别名到本机目录和 thread 的映射。 |
| `projects.*.cwd` | Codex 执行时使用的工作目录。 |
| `projects.*.threadId` | 已绑定的 Codex thread ID，空字符串表示下次任务新建。 |
| `projects.*.sharedWithCodexApp` | 标记该 thread 可被 Codex App/CLI 手动接管。 |

## 启动

```bash
cd /Users/rong/workspace/codex-qq-bridge
npm run dev -- --config ./config.json
```

启动后，bridge 会：

1. 读取配置。
2. 启动并连接 Hermes MCP Server。
3. 探测 Hermes 是否提供 `events_wait` / `events_poll` 和 `messages_send`。
4. 循环监听消息。
5. 对符合规则的 `cx` 指令调用 Codex。

## QQ 指令

### 运行任务

```text
cx 修复构建报错
```

格式：

```text
cx <task>
cx <project> <task>
```

配置了 `defaultProject` 时，可以省略 `<project>`；显式写项目名时，仍优先使用指定项目。
配置或运行时开启 `allowDirectPrivateMessage` 后，白名单用户私聊也可以直接发送任务文本；群聊仍需使用 `cx` 前缀。

示例：

```text
cx 总结当前项目结构
cx doudou-puzzle 总结当前项目结构
cx doudou-puzzle 检查最近的测试失败原因
cx doudou-puzzle 优化 README 文档
```

私聊免前缀示例：

```text
修复构建报错
```

### 切换私聊免前缀

```text
cx direct on
cx direct off
```

该开关会写入运行时状态，重启后仍生效；未切换过时使用配置里的 `allowDirectPrivateMessage` 默认值。

### 查看运行状态

```text
cx status
```

如果没有任务运行，会返回：

```text
当前没有正在运行的 Codex 任务。
directPrivateMessage=on
```

### 查看项目 threadId

```text
cx session doudou-puzzle
```

返回当前项目绑定的 Codex `threadId`，并提示不要同时从 App/CLI 和 QQ bridge 操作同一个 thread。

### 新建 Codex thread

```text
cx new doudou-puzzle
```

这会清空该项目当前保存的 `threadId`。下一次运行任务时，Codex 会创建新的 thread。

### 绑定已有 Codex thread

```text
cx attach doudou-puzzle 019df6e5-5f84-7241-bd15-516a3e9704fc
```

这会把已有 Codex App/CLI thread 绑定到项目。后续 QQ 指令会通过 `resumeThread()` 继续该 thread。

`threadId` 必须是 UUID 格式。

## 会话共享说明

Codex SDK 使用本机 Codex exec，并基于 `~/.codex/sessions` 恢复会话。因此：

- SDK 创建的 thread 理论上可以被 Codex CLI/App 通过 threadId 继续。
- Codex CLI/App 中已有的 thread 也可以用 `cx attach` 绑定给 bridge。
- App UI 不保证实时显示 SDK 新建的 thread。
- 不要同时从 Codex App/CLI 和 QQ bridge 向同一个 `threadId` 发送消息。

推荐流程：

```text
1. QQ 发送任务。
2. bridge 返回 threadId。
3. 如需在 App/CLI 接管，复制 threadId 手动 resume。
4. 接管期间不要再通过 QQ 操作同一项目。
```

## 安全策略

当前内置策略：

- 非白名单用户和群组会被忽略或拒绝。
- QQ 只能使用配置中的项目别名，不能传任意本机路径。
- 同一项目同一时间只允许一个任务运行。
- 以下危险模式会被拒绝：
  - `sudo`
  - `rm -rf /`
  - `.env`
  - `token`
  - `api_key` / `apikey`
  - `password`

第一版默认使用：

```text
sandboxMode = workspace-write
approvalPolicy = never
```

这意味着白名单 QQ 用户可以让 Codex 修改配置项目目录中的文件。请只把可信账号加入白名单。

## 日志与状态文件

运行时会生成：

```text
state.json
runs/<runId>/message.json
runs/<runId>/events.jsonl
runs/<runId>/final.json
runs/<runId>/error.json
```

说明：

| 文件 | 说明 |
| --- | --- |
| `state.json` | 保存项目 `threadId`、最近 runId、运行状态。 |
| `message.json` | 原始 Hermes/QQ 消息。 |
| `events.jsonl` | Codex SDK 事件流。 |
| `final.json` | Codex 最终结果。 |
| `error.json` | 失败时的错误信息。 |

## 开发命令

运行测试：

```bash
npm test
```

TypeScript 类型检查：

```bash
npm run check
```

开发启动：

```bash
npm run dev -- --config ./config.json
```

## 项目结构

```text
src/
  index.ts                 入口，加载配置并启动守护循环
  bridge.ts                消息分发、策略校验、Codex 调用和回发
  config.ts                配置加载和校验
  messageParser.ts         cx 指令解析
  codex/codexProvider.ts   Codex SDK startThread/resumeThread 封装
  hermes/hermesClient.ts   Hermes MCP client 封装
  policy/policy.ts         白名单、危险请求、运行锁
  store/sessionStore.ts    本地状态读写
  runLog.ts                run 日志写入
  format.ts                回复格式化和截断
  types.ts                 公共类型

tests/
  bridge.test.ts
  codexProvider.test.ts
  messageParser.test.ts
  policy.test.ts
  sessionStore.test.ts
```

## 排错

### Hermes tool 不存在

如果启动时报错：

```text
Hermes MCP tool messages_send not found
Hermes MCP tool events_wait/events_poll not found
```

说明当前 Hermes MCP Server 暴露的工具名和 bridge 预期不一致。需要检查：

```bash
hermes mcp serve
```

确认 Hermes 是否提供消息读取和发送工具。

### QQ 消息没有触发

检查：

1. QQ 账号是否在 `allowedUsers` 中。
2. 群号是否在 `allowedGroups` 中。
3. 消息是否以 `cx` 开头。
4. Hermes 是否实际收到 QQ 消息。

### Codex 认证失败

先在本机确认 Codex 可用：

```bash
codex login
codex exec "hello"
```

### threadId 冲突或上下文混乱

可能是同时从 QQ bridge 和 Codex App/CLI 操作了同一个 thread。建议：

```text
cx new doudou-puzzle
```

然后重新开始一个 thread。

## 当前限制

- 只支持 Codex，不支持 Claude。
- 不提供 Web UI。
- 不自动操作 Codex App 当前窗口。
- Hermes QQ 适配能力依赖 Hermes Agent 本身。
- Hermes MCP 事件字段当前使用宽松归一化，如果 Hermes 实际字段差异较大，可能需要调整 `src/hermes/hermesClient.ts`。
