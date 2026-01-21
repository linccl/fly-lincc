# fly-lincc 项目规范（AGENTS.md）

本文件为项目级规则（覆盖全局规则）；若与全局规则冲突，以本文件为准。

## 项目定位与运行方式

- 本地运行的局域网（LAN）Web 应用：电脑运行服务，手机/电脑浏览器访问
- 单用户主密码登录（密码正确才能进入系统）
- 数据库使用 SQLite 单文件；不做自动备份，由你手动拷贝数据库文件
- 端口与密码（哈希）可在配置文件中修改；端口冲突允许自动回退到下一个可用端口

## 技术栈约定（按仓库现状优先）

- **Runtime**：Node.js 20 LTS
- **Backend**：TypeScript + Fastify
- **DB**：SQLite + Prisma（优先使用 ORM，避免手写拼接 SQL）
- **Frontend**：Vue 3 + Vite + TypeScript
- **UI**：Naive UI 或 Element Plus（二选一，遵循仓库现状）
- **Testing**：Vitest（若仓库已有其它测试框架，以现状为准）
- **Package manager**：优先 pnpm（若仓库使用 npm/yarn，以现状为准）

## 项目结构约定

（若实际目录结构不同，以仓库现状为准。）

```
server/    # Fastify 服务、API、鉴权、静态资源托管
web/       # Vue3 前端工程（打包产物由 server 托管）
prisma/    # schema.prisma 与迁移
config/    # 运行配置（如 config.json）
data/      # SQLite 数据文件（手动拷贝备份/迁移）
scripts/   # macOS / Windows 快捷启动脚本
```

## 构建、测试与常用命令（约定脚本名）

优先在根目录提供统一脚本；若未提供，则在对应子目录运行。

```bash
# 安装依赖（首次需要联网下载依赖）
pnpm install

# 开发模式（前后端联调）
pnpm dev

# 构建前端与服务端
pnpm build

# 生产模式启动服务
pnpm start

# 测试 / Lint / 格式化（如仓库有配置）
pnpm test
pnpm lint
pnpm format
```

## 分层与数据模型（强约束）

- **禁止直接把数据库模型/Prisma Model 原样返回给前端**：必须使用响应 DTO（白名单字段）输出
- 后端建议分层：
  - Route/Controller：仅做鉴权、参数绑定、输入校验与命令派发
  - Service：承载业务逻辑（输入使用不可变的 command 对象/类型），避免耦合 Fastify Request/Reply
  - Repository：Prisma 数据访问，避免在业务里散落查询细节
- 输入校验必须在服务端兜底（前端校验仅作体验优化）

## 安全基线（必须遵守）

- 密码只允许以 **scrypt 哈希**形式保存；**禁止明文密码落盘**、禁止输出到日志
- 登录成功使用 `HttpOnly` Cookie 会话；Cookie 建议 `SameSite=Lax`
- 登录接口必须限流（按 IP）以降低暴力猜解风险
- 任何用户可控字符串：
  - 前端默认使用模板插值输出，避免 `v-html`；确需渲染富文本必须先净化
  - 后端不要对输入做 HTML 转义后入库；输出侧需要时再转义/编码
- SQL：优先使用 Prisma；若使用原生 SQL，必须参数化，禁止字符串拼接
- 日志：包含必要上下文（id、关键入参摘要），但禁止泄露密码、Token、Cookie 等敏感信息

## 配置与运维约定

- 配置文件建议：`config/config.json`（host、port、portFallback、database.path、auth.passwordHash 等）
- 端口冲突时允许自动回退到下一个可用端口（最多尝试次数在配置中控制）
- 手动迁移/备份数据库：**先停止服务**，再拷贝 `data/` 下数据库文件；若存在 `-wal/-shm` 文件应一并拷贝

## Codex 工作流（项目级）

- 中等规模以上需求（改动 > 3 个文件或引入新功能/新模块）必须先给出 Plan（背景/目标/分步计划/验收标准），经用户确认后再实现
- 修改任何现有代码文件前，若仓库存在作者检查脚本，优先执行：`./.claude/hooks/check-author.sh <file-path>`
- 遵循“最小变更”：只改与需求相关的内容，避免无关重构
- 网络默认受限：涉及依赖下载/外部请求前先征得用户确认
- Git 操作限制：禁止 `git add/commit/push/stash`；允许 `git diff/status/log/show/blame`
