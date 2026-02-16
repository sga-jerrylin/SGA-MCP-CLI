# 技术选型：MCP Hub（私有化/本地化）方案对比与推荐栈

版本：v0.1（草案）  
日期：2026-02-09  

---

## 1. 选型目标与原则

### 1.1 选型目标

- 私有化可部署：离线可运行，外部依赖可替换。
- 稳定可维护：减少“每企业一套代码”的分叉，升级与修复可规模化下发。
- 强治理：审计、脱敏、限流、可观测是默认能力。
- 插件可控：连接器适配不同系统，需要隔离、可回滚、可灰度。
- 生成器可插拔：LLM 推理可本地化或对接企业自有模型平台。

### 1.2 关键约束

- 客户网络不可控（内网/专线/代理/mTLS）。
- 合规差异大（审计落盘位置、脱敏策略、留存周期）。
- 上层客户端多样（OpenClaw 等），但你们对外希望统一为 MCP Server。

---

## 2. 总体架构选型（推荐）

建议采用“Control Plane + Data Plane + Connector Runtime + Generator”的逻辑分层：

- **Data Plane（执行面）**：对外 MCP；负责校验、策略、审计、指标；不承载具体系统差异逻辑。
- **Connector Runtime（连接器执行）**：承载系统差异（鉴权、分页、字段映射、错误映射、协议适配）。
- **Control Plane（管理面）**：租户/配置/工具/发布/审计查询/生成器管理。
- **Generator（生成器）**：文档→工具草案/映射/测试；产物进入草案库，发布前必须测试与审核。

你们的长期收益来自：Data Plane 稳定、Connector 插件化、工具包版本治理与配置收敛。

---

## 3. 语言与运行时选型

### 3.1 Data Plane（MCP Server 执行面）

候选：

1) TypeScript / Node.js（推荐）
- 优点：开发效率高；生态完善；与 MCP 相关生态更友好；JSON schema/验证工具链成熟。
- 缺点：同进程插件隔离弱，需要分进程或 worker 模式；高并发需要规范化工程约束。

2) Go
- 优点：单体部署方便；并发与稳定性强；分进程隔离更自然。
- 缺点：MCP 周边生态需要更多自研胶水；Schema/生成工具链不如 TS 丰富。

3) Java / Kotlin
- 优点：企业私有化常用；治理体系成熟；与大型客户生态更契合。
- 缺点：开发迭代速度相对慢；生成器与 JSON schema 工具链需要更多工程投入。

推荐结论：
- **MVP/V1：TypeScript/Node.js**（降低交付周期）
- 若未来性能或隔离诉求显著增长，可将 Connector Runtime 独立出来（Go/Java）而保持 Data Plane 不变。

### 3.2 Control Plane（管理端后端）

候选：

- NestJS（推荐给多人协作团队）
  - 模块化强、规范清晰、依赖注入、适合平台类项目
- Fastify（推荐给偏轻量团队）
  - 性能好、结构灵活，但规范需要团队自建

推荐：团队若要快速形成平台工程规范，优先 **NestJS**。

### 3.3 前端（管理控制台）

候选：

- React + TypeScript（推荐）
  - JSON 编辑器、表单、状态管理生态成熟；企业交付常见。
- Vue3 + TypeScript
  - 国内团队更熟悉，交付效率也高。

推荐：按你们团队栈决定；关键是选型后固定 UI 组件库与表单规范。

建议组合：
- React + TypeScript + Ant Design（或你们内部组件库）
- 状态：React Query / Zustand（二选一，保持简单）
- JSON Schema 编辑：Monaco Editor + 自建校验/辅助（或成熟 schema editor 组件）

---

## 4. 数据与存储选型

### 4.1 主数据库

推荐：PostgreSQL

- 原因：关系模型适合租户/工具/版本/发布/审计索引；JSONB 可存 schema、映射规则；生态成熟。

### 4.2 缓存/限流/幂等

推荐：Redis

- 限流计数、令牌桶、并发控制
- 幂等键存储（带 TTL）
- token cache（OAuth2 等）

### 4.3 对象存储（可选）

推荐：MinIO（私有化友好）

- OpenAPI/文档原始文件
- 生成器产物（草案、报告、diff）
- 审计归档（若需要较长留存）

---

## 5. 插件（Connector）体系选型

### 5.1 插件运行方式对比

1) 同进程加载插件（不推荐用于多客户场景）
- 优点：简单、性能好
- 风险：依赖冲突/内存泄漏/崩溃会影响主进程；安全隔离弱

2) 分进程 Connector Runtime（推荐）
- 优点：隔离强；可单独扩缩容；崩溃可重启；依赖独立
- 成本：需要定义“Connector 执行协议”（HTTP/gRPC）；需要进程管理与健康检查

推荐结论：**Connector Runtime 采用分进程**。Data Plane 调用 Connector Runtime 完成上游请求。

### 5.2 Connector 执行协议（建议）

- gRPC：性能与类型友好；适合内部服务间通信
- HTTP/JSON：实现最简单；跨语言方便；性能可接受

建议：MVP 用 HTTP/JSON（迭代快），V1 视情况升级到 gRPC。

---

## 6. 接口描述与 Schema 体系

### 6.1 工具输入输出 Schema

建议：
- 工具输入：JSON Schema（draft 2020-12 或较新稳定版本）
- 工具输出：同样使用 JSON Schema（保证上层可机读）

原因：
- 前端/后端/生成器一致使用
- 生成器从 OpenAPI 可直接映射
- 可生成表单/校验/示例

### 6.2 OpenAPI 导入策略

优先支持：
- OpenAPI 3.0/3.1 JSON/YAML

生成路径：
OpenAPI → 中间表示（IR）→ 工具草案（Tool Draft）+ 映射草案 + 测试草案

---

## 7. 安全与合规选型

### 7.1 密钥管理

私有化环境分档：

- S 级：对接企业 Vault/KMS（最优）
- A 级：本地加密配置文件（使用部署时注入的 master key）+ 环境变量注入
- B 级：仅环境变量（最简单，但运维体验差）

默认建议：A 级起步，预留 S 级接口。

### 7.2 传输安全

- 内网也建议 TLS
- 支持企业 CA 证书链
- mTLS 作为企业高要求选项（尤其是跨网段与安全域）

### 7.3 脱敏与审计

- 字段级脱敏（按 JSON Path）
- 可配置“不落盘字段”
- 审计记录与 traceId 贯通（便于追责与排障）

---

## 8. 可观测性选型

### 8.1 指标

- Prometheus 指标输出（HTTP /metrics）
- 指标维度：tenant/tool/connectorInstance（注意高基数控制）
- 核心指标：
  - 请求量、成功率、P95/P99、上游错误率、重试次数、断路器状态

### 8.2 日志

- 结构化日志（JSON）
- 统一字段：traceId、tenantId、toolName、connectorInstanceId、latencyMs、status
- 日志系统：客户可选 ELK/Loki/本地文件

### 8.3 追踪（可选）

- OpenTelemetry SDK
- 导出到 Jaeger/Tempo（客户自选）

---

## 9. 部署形态选型

### 9.1 单企业单实例（推荐起步）

- 一个租户对应一套部署
- 优点：隔离天然；客户接受度高；运维简单
- 缺点：你们维护实例数量可能增加

### 9.2 多租户共享集群（可选）

- 适合你们自营或集团客户
- 要求：更完备的 RBAC、资源配额、隔离策略

推荐：先支持单企业单实例；多租户作为能力保留但不强推。

---

## 10. 生成器（LLM）选型

### 10.1 推理方式

- 本地推理：Ollama / vLLM（私有化友好）
- 企业模型平台：通过统一 Inference Adapter 对接（HTTP API）

### 10.2 生成产物定位（关键原则）

- 生成的是“草案 + 可验证测试”，不是直接上线的最终版本。
- 生成必须可追溯：输入 hash、模型版本、提示词版本、输出 hash。
- 发布必须通过 smoke test。

---

## 11. 推荐落地栈（MVP/V1）

### 11.1 MVP 推荐

- Data Plane：Node.js + TypeScript
- Control Plane：NestJS（或 Fastify）
- 前端：React + TS + AntD（或 Vue3 + TS）
- DB：PostgreSQL
- Cache：Redis
- Connector Runtime：HTTP/JSON 独立进程（可 Node/Go）
- 观测：结构化日志 + Prometheus 指标
- 生成器：OpenAPI 导入 + schema 草案 + smoke test 草案（LLM 可选/可后置）

### 11.2 V1 加强

- OAuth2、mTLS
- 配置与工具包版本化更完善（diff、灰度、回滚）
- OpenTelemetry tracing
- 生成器增强（字段映射/错误映射/测试用例生成）

