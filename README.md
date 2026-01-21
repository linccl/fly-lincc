# 自律记录本地站点（LAN）技术方案

## 目标与约束

- 电脑上运行服务（macOS / Windows 都可）
- 局域网内手机与电脑可访问（浏览器打开即可用）
- 数据落地为可拷贝的数据库文件（SQLite）
- 有密码：密码正确才能进入系统
- 端口号与密码可在配置文件中修改
- 端口冲突时允许自动回退到下一个可用端口
- 提供 macOS / Windows 的快捷启动脚本
- 不做自动备份：你手动拷贝数据库文件即可

## 推荐技术栈

### 后端（服务端）

- 运行时：Node.js 20 LTS
- Web 框架：Fastify
  - 同一进程同时提供 API + 静态网页（前端打包产物）
  - 监听 `0.0.0.0` 以便局域网设备访问
- 鉴权：单用户“主密码”登录 + HttpOnly Cookie 会话
  - 密码存储：`scrypt` 哈希（不存明文，跨平台无原生依赖）
  - 防暴力尝试：Fastify rate limit（按 IP 限流）

### 数据库

- SQLite 单文件数据库：例如 `data/app.db`
- ORM / 迁移：Prisma

### 前端

- Vue 3 + Vite + TypeScript
- 路由：Vue Router
- 状态管理：Pinia（可选）
- UI：Naive UI（或 Element Plus，二选一）
- 图表：ECharts（统计报表）

## 目录与组件划分（建议）

- `server/`：Fastify 服务、API、鉴权、中间件、静态资源托管
- `web/`：Vue3 前端工程（构建后产物由 server 托管）
- `prisma/`：`schema.prisma`、迁移文件
- `data/`：SQLite 数据文件（你手动拷贝备份/迁移）
- `config/`：运行配置
- `scripts/`：快捷启动脚本（macOS / Windows）

## 配置文件约定

建议使用 `config/config.json`，并允许你随时修改端口与密码。

首次使用建议：

1. 复制 `config/config.example.json` 为 `config/config.json`
2. 运行 `pnpm set-password`（或 `npm run set-password`）写入密码哈希与会话密钥

### 示例（建议字段）

```json
{
  "host": "0.0.0.0",
  "port": 3000,
  "portFallback": { "enabled": true, "maxAttempts": 20 },
  "database": { "path": "./data/app.db" },
  "auth": {
    "passwordHash": "<scrypt hash here>",
    "sessionSecret": "<random secret here>",
    "session": { "cookieName": "sd_session", "ttlDays": 30 }
  }
}
```

### 修改密码的建议方式

出于安全原因，不建议把明文密码直接写进配置文件。推荐做法：

- 配置里只保存 `passwordHash`
- 提供脚本 `scripts/set-password`（跨平台可做成 `node scripts/set-password.mjs`）
  - 运行脚本后交互式输入新密码
  - 脚本会计算 scrypt 哈希并写回 `config/config.json`

这仍然满足“密码在配置文件可修改”（通过脚本更新配置文件），且不会在磁盘上留下明文密码。

## 端口冲突回退策略

- 启动时先尝试 `config.port`
- 若端口占用，按顺序尝试 `port+1`、`port+2` ……
- 最多尝试 `config.portFallback.maxAttempts` 次
- 启动成功后在控制台输出实际监听端口与访问地址

## 启动与访问

### 首次安装依赖（需要联网下载依赖）

在项目根目录执行其一：

- `pnpm install`（推荐）
- `npm install`

### 运行服务

建议提供统一命令（示例）：

- `pnpm start` / `npm run start`：启动服务（生产模式）
- `pnpm dev` / `npm run dev`：前后端开发模式（可选）

### 局域网访问

- 确保电脑与手机在同一局域网（同一 Wi‑Fi）
- 服务绑定 `0.0.0.0` 后，手机访问：`http://<电脑局域网IP>:<端口>/`
- Windows 可能会弹出防火墙提示：允许 Node.js 监听“专用网络”

## 快捷启动脚本（交付要求）

放在 `scripts/` 下：

- macOS：`scripts/start-mac.command`
  - 双击运行
  - 自动切到项目根目录
  - 若未安装依赖则提示先执行 `pnpm install`/`npm install`
  - 启动服务并打印访问地址
- Windows：`scripts/start-windows.bat`
  - 双击运行
  - 自动切到项目根目录
  - 若未安装依赖则提示先执行 `pnpm install`/`npm install`
  - 启动服务并打印访问地址

（可选）脚本在启动后自动打开浏览器：macOS 用 `open`，Windows 用 `start`。

## 手动拷贝备份/迁移（你负责执行）

推荐方式：

1. 先停止服务（避免写入过程中拷贝导致不一致）
2. 直接拷贝整个 `data/` 目录
   - 若启用了 SQLite WAL，可能会出现 `app.db-wal` 与 `app.db-shm`，一起拷走最稳妥
3. 在另一台机器上放回同路径，启动服务即可继续使用

## 最小验收标准（建议）

- 修改 `config/config.json` 的 `port` 后，服务按新端口启动
- 配置端口被占用时，能自动回退到可用端口并提示实际端口
- 未登录访问任意页面会跳转到登录页
- 输入正确密码后可进入系统；错误密码会被拒绝且有简单限流
- 新增一条记录后能落到 `data/app.db`，关闭服务后拷贝 `data/` 再启动数据不丢
