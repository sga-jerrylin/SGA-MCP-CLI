# 场景与流程：MCP Hub 配置→提交→重启/重建→按分类生成多容器

版本：v0.1（草案）  
日期：2026-02-09  

---

## 1. 目标

定义一个可落地的“交付与运维流程”，满足：

- 系统启动后，用户进入配置页面完成配置。
- 配置完成后点击“提交”，触发 Docker 重启/重建流程。
- 生成“按分类分片”的 MCP Server 容器：**一个分类一个容器，一个容器的 MCP tools 不超过 40 个**。
- 分类体系支持 **3 级**（L1/L2/L3）。

---

## 2. 核心约束与假设

- 约束 A：单个 MCP Server 暴露过多工具会造成客户端工具选择困难与上下文过载，因此强制分片（shard）。
- 约束 B：每个分片容器的工具数上限为 40。
- 约束 C：分类支持 3 级，用于业务域组织与分片生成。
- 假设 D：本平台以“私有化交付”为主，客户允许通过 Docker/Compose 管理容器生命周期。

---

## 3. 术语

- 分类（Category）：3 级树形结构
  - L1：一级域（例如 供应链、财务、CRM）
  - L2：二级域（例如 库存、采购、应收）
  - L3：三级域（例如 库存查询、库存调整）
- 分片（Shard）：一个 MCP Server 实例（一个容器），绑定到某个分类节点（通常是 L2 或 L3），只暴露该节点下的工具集合。
- 端点（Endpoint）：一个分片容器对外提供的 MCP 接入地址（端口不同）。

---

## 4. 配置对象（最小集合）

配置提交时，至少包含：

1) 连接器实例（Connector Instances）
- baseUrl
- 鉴权方式与密钥引用
- TLS/代理/超时配置

2) 工具草案与发布版本（Tools / Tool Package Versions）
- toolName、displayName、description
- inputSchema/outputSchema/examples
- mappingRules
- 绑定 connectorInstanceId
- 发布版本 active 指向

3) 分类树（Categories，3级）
- L1/L2/L3 节点定义
- 每个工具归属到某个分类节点（建议归属到 L3）

4) 分片策略（Sharding Policy）
- 单容器最大工具数：40（硬约束）
- 分片粒度：优先 L3；若 L3 工具数过少，可合并到 L2（策略可配置）
- 端口分配策略：起始端口 + 自增（例如从 7101 开始）

---

## 5. 用户端流程（从启动到可用）

### 5.1 系统启动

1. 运维启动 MCP Hub（Control Plane + Data Plane 基础组件）。
2. 前端控制台可访问（登录或本地账号）。
3. 系统处于“未配置/未发布”状态时，不对外暴露任何分片端点（或仅暴露空 tools/list）。

### 5.2 配置阶段（配置页面）

用户在控制台完成以下步骤：

1) 配置连接器实例
- 新建 connector instance，填写 baseUrl、鉴权、证书等
- 点击“连通性测试”确认可访问

2) 导入/创建工具
- 导入 OpenAPI 或手工创建工具草案
- 绑定 connector instance
- 编辑/校验 schema 与示例

3) 配置分类（3级）
- 创建 L1/L2/L3 分类
- 将工具分配到 L3 分类（默认）

4) 生成/更新工具包版本并执行 smoke test
- 从草案集合生成 package version
- 执行 smoke test：通过才能进入发布候选

### 5.3 提交阶段（点击“提交并重建容器”）

点击“提交”触发以下动作（后端自动编排）：

1. 锁定当前发布候选（package version + 分类树 + 连接器配置），生成一个不可变的“发布快照（Release Snapshot）”。
2. 基于发布快照进行“分片规划（Shard Plan）”：
   - 将工具按分类聚合
   - 对任何分类节点，若工具数 > 40，则在该节点内部进一步切分为多个 shard（例如 `inventory.query#1`、`inventory.query#2`）
   - 产出：
     - shard 列表（每个 shard 的工具清单）
     - shard → 端口映射
     - shard → 镜像/容器配置（环境变量、挂载配置等）
3. 生成运行时配置产物（Artifacts）：
   - `shards.json`：分片清单、端点、工具列表摘要
   - 每个 shard 的 `toolset.json`：该 shard 的 tools 定义快照（含 schema）
   - 每个 shard 的 connector 配置引用（不含明文密钥）

### 5.4 生效阶段（Terminal 日志流展示）

前端展示一个 Terminal 窗口，实时流式输出后端执行日志：

1. **[ShardManager] Calculating...**：展示分片计算结果（如 "Plan: 3 shards (Finance, SCM, HR)"）。
2. **[Builder] Generating Configs...**：生成 Docker Compose 与工具定义文件。
3. **[Docker] Recreating Containers...**：
   - `Stopping old containers...`
   - `Building images...` (若采用模式 B)
   - `Starting mcp-shard-1 (Port 8081)...`
   - `Starting mcp-shard-2 (Port 8082)...`
4. **[HealthCheck] Probing...**：对所有新启动容器执行 `tools/list` 探测。
5. **[Registry] Updating...**：更新服务发现注册表。
6. **Deployment Completed**：发布成功，展示新拓扑。

### 5.5 对外可用阶段（给 Agent 连接）

1. 平台对外提供“分片注册表”（Shard Registry）：
   - 返回每个分类 shard 的 MCP endpoint（端口不同）
2. 外部 Agent（例如 OpenClaw）接入逻辑：
   - 先读取分片注册表，按需选择连接某些分类（而不是一次拉全量工具）
   - 对选定 shard 执行 tools/list 获取工具表
   - 如需自动写 skill：再读取 Catalog（工具目录）获取更丰富元数据

---

## 6. 分片规划规则（Sharding Rules）

### 6.1 分类到分片的默认规则

- 默认将 **L3 分类**映射为一个 shard（一个容器）。
- 如果某 L3 工具数为 0：不生成 shard。
- 如果某 L3 工具数在 1～40：生成 1 个 shard。
- 如果某 L3 工具数 > 40：
  - 自动拆为多个 shard：`{L3}#1..#N`，每个 shard ≤ 40。

### 6.2 合并规则（避免 shard 过碎）

当 L3 工具数过少、导致 shard 太碎，可启用合并策略（可配置）：

- 将同一 L2 下多个 L3 合并到一个 shard，直到 40 上限
- 合并后的 shard 仍保留“分类元数据”，便于 Catalog 侧呈现 L3 归属

### 6.3 端口分配规则

- 基础端口 `basePort`（例如 7101）
- shard 按稳定顺序排序（例如按 L1/L2/L3 + shardIndex）
- 端口 = `basePort + shardOrdinal`
- 端口冲突检测：若端口占用，阻止发布并提示调整 basePort 或释放端口

---

## 7. 交付产物（给运维/客户）

至少输出：

- `docker-compose.yml`（或等价编排配置）
  - 包含每个 shard 容器、端口映射、挂载目录（配置/证书）
- `shards.json`（分片注册表）
- 每个 shard 的配置目录：
  - `toolset.json`（该 shard 的工具清单与 schema）
  - `policies.json`（限流/脱敏/超时策略）
  - `connectorRefs.json`（连接器引用，不含明文密钥）
- 回滚包：
  - 上一个 Release Snapshot 的 artifacts（用于一键回滚）

---

## 8. 控制台交互（前端按钮与状态机）

### 8.1 状态机

- Draft：草案（可编辑）
- Candidate：发布候选（已生成版本+测试通过）
- Applying：提交中（生成 shard plan / 产物）
- Building：构建中（模式 B）
- Restarting：重启/重建中
- Active：生效（对外 endpoint 可用）
- Failed：失败（可查看原因并重试/回滚）

### 8.2 “提交并生效”按钮行为

点击后：

1) 前端调用后端发布 API（建议异步 job）  
2) 前端进入 Applying/Building/Restarting 状态，显示实时日志  
3) 成功后展示：
- 生效版本号
- 分片数量
- 每个分类对应的 endpoint（端口）
4) 失败后展示：
- 失败阶段（Applying/Building/Restarting）
- 错误原因（端口冲突、构建失败、连通性失败等）
- “重试/回滚”按钮

---

## 9. 失败场景与处理

- 端口冲突：阻止发布，提示调整 basePort 或释放端口。
- 构建失败（模式 B）：保留日志与构建上下文 hash；不切换 active；支持重试。
- 重启失败：不切换 active；支持回滚到上一版本。
- 工具数超限但无法拆分：阻止发布（说明某分类归属配置不合理）。
- 连接器连通性失败：可配置为“阻止发布”或“允许发布但标记该 shard 不健康”。

