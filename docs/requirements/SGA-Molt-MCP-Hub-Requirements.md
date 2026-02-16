# SGA-Molt MCP Hub — 全量 Tool 清单与架构设计

> **项目内部代号：** SGA-Molt MCP Hub
> **文档用途：** MCP 侧全量 Tool 梳理、分类、架构设计与实现规划
> **编写日期：** 2026-02-15
> **负责人：** 我（MCP Hub 整体）/ 嘉鑫（Claw 侧对接）

---

## 〇、全量 Tool 概览（8 大类 / 128 个 Tool）

> 以下为 MCP Hub 所有 Tool 的完整罗列，按部署条件分为 8 大类。详细 Schema 和实现思路见后续章节。

### 第 1 类：本地算力模型类（GPU Model Services）

> 基于本地 4090/5090 显卡部署的推理模型，提供 AI 基础能力

| # | Tool 名称 | 底层项目 | 功能说明 | GPU 需求 |
|---|-----------|---------|---------|---------|
| 1.1 | `ocr.recognize` | DeepSeek-OCR | 图片/PDF 文字识别，支持中英文、表格、手写体 | 中 |
| 1.2 | `tts.synthesize` | Qwen3-TTS | 文本转语音，支持多语言多音色 | 中 |
| 1.3 | `tts.clone_synthesize` | Index-TTS | 音色克隆 + 语音合成，基于参考音频复刻音色 | 中 |
| 1.4 | `asr.transcribe` | Qwen3-ASR | 语音转文字，支持说话人分离和时间戳 | 中 |
| 1.5 | `digital_human.generate` | HeyGem | 数字人视频生成，驱动虚拟形象说话 | 高（24GB+） |
| 1.6 | `document.parse` | MinerU | 复杂文档智能解析（PDF/图表/公式/多栏排版） | 中 |
| 1.7 | `vision.analyze` | MiniCPM-o-4.5 | 多模态理解（图片描述/图表分析/视频理解/问答） | 中 |

---

### 第 2 类：本地服务支持类（GPU-Backed Services）

> 企业和个人的两大核心支柱：知识库 + 数据库

**2.1 SGA-RAG（基于 RAGFlow 改造，RAG + 知识图谱）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 2.1.1 | `sga_rag.search` | 语义检索 + 知识图谱增强检索 |
| 2.1.2 | `sga_rag.graph_query` | 知识图谱关系查询（多跳推理） |
| 2.1.3 | `sga_rag.upload` | 上传文档，自动解析、切片、embedding、入图谱 |
| 2.1.4 | `sga_rag.upload_status` | 查询文档解析进度 |
| 2.1.5 | `sga_rag.list_collections` | 列出所有知识库 collection |
| 2.1.6 | `sga_rag.create_collection` | 创建新的知识库 collection |
| 2.1.7 | `sga_rag.delete_document` | 删除指定文档 |
| 2.1.8 | `sga_rag.promote` | 从 Claw 记忆提升内容到 RAG 知识库 |
| 2.1.9 | `sga_rag.summary` | 对指定 collection 或文档生成摘要 |

**2.2 SGA-Matrix（基于 Doris 的问数系统）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 2.2.1 | `sga_matrix.query` | 自然语言查询数据库，自动生成 SQL 并执行 |
| 2.2.2 | `sga_matrix.list_datasets` | 列出可查询的数据集/表 |
| 2.2.3 | `sga_matrix.get_schema` | 获取表结构定义 |
| 2.2.4 | `sga_matrix.execute_sql` | 直接执行 SQL（需高级权限） |
| 2.2.5 | `sga_matrix.create_chart` | 基于查询结果生成可视化图表 |
| 2.2.6 | `sga_matrix.export` | 导出查询结果为 CSV/Excel |

---

### 第 3 类：系统耦合连接类（Enterprise System Integration）

> 对接企业核心业务系统，鉴权在 MCP Hub 内完成，安全级别最高

**3.1 用友 ERP（yonyou）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 3.1.1 | `yonyou.query_voucher` | 查询凭证 |
| 3.1.2 | `yonyou.create_voucher` | 创建凭证（需确认） |
| 3.1.3 | `yonyou.query_inventory` | 查询库存 |
| 3.1.4 | `yonyou.query_sales_order` | 查询销售订单 |
| 3.1.5 | `yonyou.create_sales_order` | 创建销售订单（需确认） |
| 3.1.6 | `yonyou.query_purchase` | 查询采购订单 |
| 3.1.7 | `yonyou.create_purchase` | 创建采购订单（需确认） |
| 3.1.8 | `yonyou.query_receivable` | 查询应收 |
| 3.1.9 | `yonyou.query_payable` | 查询应付 |
| 3.1.10 | `yonyou.get_report` | 获取财务报表 |
| 3.1.11 | `yonyou.query_customer` | 查询客户档案 |
| 3.1.12 | `yonyou.query_supplier` | 查询供应商档案 |

**3.2 招行薪福通（cmb_payroll）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 3.2.1 | `cmb_payroll.query_batch` | 查询薪资批次列表 |
| 3.2.2 | `cmb_payroll.query_detail` | 查询某批次明细 |
| 3.2.3 | `cmb_payroll.create_batch` | 创建薪资发放批次（需确认） |
| 3.2.4 | `cmb_payroll.submit_batch` | 提交批次发放（需二次确认） |
| 3.2.5 | `cmb_payroll.query_status` | 查询发放状态 |
| 3.2.6 | `cmb_payroll.download_receipt` | 下载发放回单 |

**3.3 银企直联（bank_enterprise）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 3.3.1 | `bank_enterprise.query_balance` | 查询账户余额 |
| 3.3.2 | `bank_enterprise.query_statement` | 查询账户流水 |
| 3.3.3 | `bank_enterprise.transfer` | 发起转账（需二次确认） |
| 3.3.4 | `bank_enterprise.query_transfer` | 查询转账状态 |
| 3.3.5 | `bank_enterprise.download_receipt` | 下载电子回单 |

**3.4 企企（qiqi）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 3.4.1 | `qiqi.query_project` | 查询项目列表/详情 |
| 3.4.2 | `qiqi.query_expense` | 查询费用报销单 |
| 3.4.3 | `qiqi.create_expense` | 创建费用报销单 |
| 3.4.4 | `qiqi.approve_expense` | 审批费用报销（需确认） |
| 3.4.5 | `qiqi.query_budget` | 查询预算执行情况 |

---

### 第 4 类：新媒体预处理类（Media Generation & Processing）

> AI 图片生成与处理，部分需本地 GPU，部分调用外部 API

| # | Tool 名称 | 底层项目 | 功能说明 |
|---|-----------|---------|---------|
| 4.1 | `image.generate` | Seedream / Qwen3-Image | AI 文生图（支持多引擎切换） |
| 4.2 | `image.edit` | Google Nano / Banana | AI 改图（局部修改、风格变换） |
| 4.3 | `image.fusion` | 多图融合服务 | 多图融合/风格迁移 |
| 4.4 | `image.upscale` | 超分辨率模型 | 图片放大增强 |
| 4.5 | `image.remove_bg` | 背景移除模型 | 智能抠图/背景移除 |
| 4.6 | `image.describe` | 复用 vision.analyze | 图片内容描述 |
| 4.7 | `image.compress` | 本地工具 | 图片压缩/格式转换 |
| 4.8 | `image.batch_process` | 批处理引擎 | 批量图片处理 |

---

### 第 5 类：视频生成类（Video Generation）

> 主要依赖外部 API，高成本、长耗时，全部异步执行

| # | Tool 名称 | 底层项目 | 功能说明 |
|---|-----------|---------|---------|
| 5.1 | `video.generate` | Seedance / Sora | AI 文生视频 / 图生视频 |
| 5.2 | `video.query_status` | — | 查询视频生成任务状态 |
| 5.3 | `video.extend` | Seedance / Sora | 视频延长 |
| 5.4 | `video.combine` | FFmpeg | 多段视频拼接 |
| 5.5 | `video.add_subtitle` | ASR + FFmpeg | 自动生成字幕并嵌入 |
| 5.6 | `video.add_audio` | FFmpeg | 添加音频/配乐 |
| 5.7 | `video.extract_frames` | FFmpeg | 提取关键帧 |

---

### 第 6 类：信息收集类（Information Gathering）

> 本地部署，需公网出口

**6.1 SGA-Web（基于 SearXNG 的网络搜索引擎）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 6.1.1 | `sga_web.search` | 网络搜索（聚合多引擎） |
| 6.1.2 | `sga_web.fetch_page` | 抓取网页内容（自动解析为 Markdown） |
| 6.1.3 | `sga_web.search_images` | 图片搜索 |
| 6.1.4 | `sga_web.search_news` | 新闻搜索 |
| 6.1.5 | `sga_web.search_academic` | 学术论文搜索 |

**6.2 SGA-Hotnews（热点资讯收集）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 6.2.1 | `sga_hotnews.get_trending` | 获取当前热点（微博/知乎/头条/百度等） |
| 6.2.2 | `sga_hotnews.get_by_topic` | 按话题获取相关资讯 |
| 6.2.3 | `sga_hotnews.subscribe` | 订阅关键词，有新热点时通知 |
| 6.2.4 | `sga_hotnews.get_summary` | 获取某热点事件的综合摘要 |

**6.3 Catfish（舆情监控系统）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 6.3.1 | `catfish.monitor_add` | 添加舆情监控关键词 |
| 6.3.2 | `catfish.monitor_list` | 查看当前监控列表 |
| 6.3.3 | `catfish.get_alerts` | 获取舆情预警 |
| 6.3.4 | `catfish.get_sentiment` | 获取某话题的情感分析 |
| 6.3.5 | `catfish.get_report` | 生成舆情分析报告 |
| 6.3.6 | `catfish.get_trend` | 获取关键词传播趋势 |

---

### 第 7 类：办公文档类（Office Document Generation）

> 纯 CPU 运行，本地生成各类办公文档

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 7.1 | `doc.create` | 生成 Word 文档（支持模板和自定义样式） |
| 7.2 | `doc.pdf_create` | 生成 PDF（从 Markdown/HTML/Word 转换） |
| 7.3 | `doc.excel_create` | 生成 Excel（支持多 sheet、图表、公式） |
| 7.4 | `doc.ppt_create` | 生成 PPT（支持模板、多种布局） |
| 7.5 | `doc.convert` | 文档格式互转（docx↔pdf↔html↔md） |
| 7.6 | `doc.merge_pdf` | PDF 合并/拆分/加水印 |
| 7.7 | `doc.fill_template` | 基于模板 + 数据批量填充文档（合同、报告等） |
| 7.8 | `doc.read` | 读取文档内容，返回结构化文本 |

---

### 第 8 类：企业微信功能类（WeCom Integration）

> 基于企业微信 API 的深度集成，是 SGA-Molt 的核心交互和协作渠道

**8.1 SGA-Phone（企业微信消息系统）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 8.1.1 | `sga_phone.send_text` | 发送文本消息（指定用户/群） |
| 8.1.2 | `sga_phone.send_image` | 发送图片消息 |
| 8.1.3 | `sga_phone.send_file` | 发送文件 |
| 8.1.4 | `sga_phone.send_video` | 发送视频 |
| 8.1.5 | `sga_phone.send_card` | 发送图文卡片 |
| 8.1.6 | `sga_phone.send_markdown` | 发送 Markdown 消息 |
| 8.1.7 | `sga_phone.send_template` | 发送模板消息 |
| 8.1.8 | `sga_phone.batch_send` | 批量群发（按用户列表/标签/部门） |
| 8.1.9 | `sga_phone.get_contacts` | 获取通讯录（部门/人员列表） |
| 8.1.10 | `sga_phone.get_group_list` | 获取群列表 |
| 8.1.11 | `sga_phone.create_group` | 创建群聊 |

**8.2 SGA-Meeting（腾讯会议管理）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 8.2.1 | `sga_meeting.create` | 预定腾讯会议 |
| 8.2.2 | `sga_meeting.update` | 修改会议信息 |
| 8.2.3 | `sga_meeting.cancel` | 取消会议 |
| 8.2.4 | `sga_meeting.list_upcoming` | 查询即将到来的会议 |
| 8.2.5 | `sga_meeting.get_detail` | 获取会议详情（含参会人、链接） |
| 8.2.6 | `sga_meeting.get_recording` | 获取会议录制 |
| 8.2.7 | `sga_meeting.invite` | 邀请参会人 |

**8.3 SGA-Mail（企业微信邮箱）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 8.3.1 | `sga_mail.list_inbox` | 获取收件箱列表 |
| 8.3.2 | `sga_mail.get_mail` | 获取邮件详情（正文 + 附件列表） |
| 8.3.3 | `sga_mail.download_attachment` | 下载邮件附件 |
| 8.3.4 | `sga_mail.send` | 发送邮件 |
| 8.3.5 | `sga_mail.reply` | 回复邮件 |
| 8.3.6 | `sga_mail.forward` | 转发邮件 |
| 8.3.7 | `sga_mail.search` | 搜索邮件 |
| 8.3.8 | `sga_mail.summarize_inbox` | 智能摘要收件箱（今日未读） |
| 8.3.9 | `sga_mail.organize` | 智能整理邮件（分类、标记、归档） |

**8.4 SGA-Calendar（企业微信日历/日程）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 8.4.1 | `sga_calendar.list_events` | 查询日程列表（按时间范围） |
| 8.4.2 | `sga_calendar.get_event` | 获取日程详情 |
| 8.4.3 | `sga_calendar.create_event` | 创建日程 |
| 8.4.4 | `sga_calendar.update_event` | 修改日程 |
| 8.4.5 | `sga_calendar.delete_event` | 删除日程 |
| 8.4.6 | `sga_calendar.check_free_busy` | 查询忙闲状态 |
| 8.4.7 | `sga_calendar.find_slot` | 智能找时间（多人共同空闲时段） |
| 8.4.8 | `sga_calendar.daily_brief` | 今日日程简报 |

**8.5 SGA-Remind（企业微信提醒系统）**

| # | Tool 名称 | 功能说明 |
|---|-----------|---------|
| 8.5.1 | `sga_remind.create` | 创建提醒 |
| 8.5.2 | `sga_remind.list` | 查看提醒列表 |
| 8.5.3 | `sga_remind.update` | 修改提醒 |
| 8.5.4 | `sga_remind.delete` | 删除提醒 |
| 8.5.5 | `sga_remind.snooze` | 延后提醒 |

---

### 汇总统计

| 类别 | Tool 数量 | GPU | 优先级 |
|------|----------|-----|--------|
| 1. 本地算力模型类 | 7 | ✅ 必须 | P0 |
| 2. 本地服务支持类 | 15 | ✅ 必须 | P0 |
| 3. 系统耦合连接类 | 28 | ❌ | P1（按客户） |
| 4. 新媒体预处理类 | 8 | ⚠️ 部分 | P1 |
| 5. 视频生成类 | 7 | ❌ 外部API | P2 |
| 6. 信息收集类 | 15 | ❌ | P0 |
| 7. 办公文档类 | 8 | ❌ | P0 |
| 8. 企业微信功能类 | 40 | ❌ | P0 |
| **合计** | **128** | — | — |

---

## 一、MCP Hub 总体架构

### 1.1 定位

MCP Hub 是 SGA-Molt 平台的**工具执行层**，为 Claw 侧的 Skill 和 Agent 提供所有外部能力的标准化调用接口。所有 Tool 通过 MCP 协议（JSON-RPC）注册和暴露，Claw 侧无需关心底层实现细节。

### 1.2 架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                        MCP Hub 总控                               │
│                                                                   │
│   ┌───────────┐   ┌───────────┐   ┌───────────┐                 │
│   │ Tool 注册  │   │ 鉴权中心   │   │ 路由分发   │                 │
│   │ Registry  │   │ Auth Gate │   │ Router    │                 │
│   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘                 │
│         └────────────────┼───────────────┘                       │
│                          │                                        │
│   ┌──────────────────────▼──────────────────────────────────┐    │
│   │                   MCP Server 集群                        │    │
│   │                                                          │    │
│   │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │    │
│   │  │ Cat.1      │ │ Cat.2      │ │ Cat.3      │          │    │
│   │  │ 本地模型类  │ │ 本地服务类  │ │ 系统耦合类  │          │    │
│   │  │ GPU 算力   │ │ GPU 服务   │ │ ERP/财务   │          │    │
│   │  └────────────┘ └────────────┘ └────────────┘          │    │
│   │                                                          │    │
│   │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │    │
│   │  │ Cat.4      │ │ Cat.5      │ │ Cat.6      │          │    │
│   │  │ 新媒体类   │ │ 视频生成类  │ │ 信息收集类  │          │    │
│   │  │ 图片处理   │ │ AI视频     │ │ 搜索/舆情   │          │    │
│   │  └────────────┘ └────────────┘ └────────────┘          │    │
│   │                                                          │    │
│   │  ┌────────────┐ ┌────────────┐                          │    │
│   │  │ Cat.7      │ │ Cat.8      │                          │    │
│   │  │ 办公文档类  │ │ 企业微信类  │                          │    │
│   │  │ 文件生成   │ │ 通信/协作   │                          │    │
│   │  └────────────┘ └────────────┘                          │    │
│   └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 MCP Hub 核心模块

| 模块 | 职责 |
|------|------|
| **Tool Registry** | 所有 Tool 的注册、发现、schema 管理 |
| **Auth Gate** | 统一鉴权（系统级鉴权如 ERP 登录态、API Key 管理） |
| **Router** | 将 Claw 的 Tool 调用路由到对应的 MCP Server |
| **Health Monitor** | 各 MCP Server 的健康检查和状态上报 |
| **Queue Manager** | 耗时任务（视频生成、文档解析）的异步队列管理 |
| **GPU Scheduler** | GPU 资源调度（多个模型共享显卡时的排队和优先级） |

### 1.4 部署模型

```
物理部署（单机或多机）：

┌─────────────────────────────────────┐
│  GPU 服务器（4090/5090）             │
│  ├── 本地模型类 MCP Server           │
│  ├── SGA-RAG（RAGFlow + GPU）        │
│  └── GPU Scheduler                  │
├─────────────────────────────────────┤
│  CPU 服务器 / 同机                   │
│  ├── MCP Hub 总控                    │
│  ├── 系统耦合类 MCP Server           │
│  ├── 办公文档类 MCP Server           │
│  ├── 企业微信类 MCP Server           │
│  ├── 信息收集类 MCP Server           │
│  └── Claw Gateway                   │
└─────────────────────────────────────┘

所有通信走本地网络，MCP Hub 与 Claw 同机部署。
外部 API 类（Sora、Seedance 等）走公网。
```

---

## 二、全量 Tool 清单（8 大类）

---

### ■ 第 1 类：本地算力模型类（GPU Model Services）

**部署条件：** 需要本地 GPU（4090/5090），通过推理服务暴露能力

**资源说明：** 这是 GPU 资源消耗最重的一类，需要 GPU Scheduler 统一调度，避免多个模型同时跑导致 OOM。

| # | Tool 名称 | 底层项目 | 功能 | GPU 需求 |
|---|-----------|---------|------|---------|
| 1.1 | `ocr.recognize` | DeepSeek-OCR | 图片/PDF 文字识别 | 中（可量化后 8GB） |
| 1.2 | `tts.synthesize` | Qwen3-TTS | 文本转语音 | 中 |
| 1.3 | `tts.clone_synthesize` | Index-TTS | 音色克隆 + 语音合成 | 中 |
| 1.4 | `asr.transcribe` | Qwen3-ASR | 语音转文字 | 中 |
| 1.5 | `digital_human.generate` | HeyGem | 数字人视频生成 | 高（24GB+） |
| 1.6 | `document.parse` | MinerU | 复杂文档智能解析（PDF/图表/公式） | 中 |
| 1.7 | `vision.analyze` | MiniCPM-o-4.5 | 多模态理解（图片/视频/文档理解） | 中（可量化） |

#### Tool 详细设计

**1.1 `ocr.recognize`**

```json
{
  "name": "ocr.recognize",
  "description": "识别图片或PDF中的文字内容，支持中英文、表格、手写体",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string", "description": "本地文件路径" },
      "file_base64": { "type": "string", "description": "Base64编码（与file_path二选一）" },
      "file_type": { "type": "string", "enum": ["image", "pdf"], "default": "image" },
      "language": { "type": "string", "default": "auto", "description": "识别语言，auto自动检测" },
      "output_format": { "type": "string", "enum": ["text", "markdown", "json"], "default": "markdown" },
      "page_range": { "type": "string", "description": "PDF页码范围，如 1-5" }
    },
    "required": ["file_type"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string" },
      "pages": { "type": "array", "items": { "type": "object" } },
      "confidence": { "type": "number" }
    }
  }
}
```

**1.2 `tts.synthesize`**

```json
{
  "name": "tts.synthesize",
  "description": "将文本转换为语音，支持多种语言和音色",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "要合成的文本" },
      "voice_id": { "type": "string", "default": "default", "description": "音色ID" },
      "language": { "type": "string", "default": "zh-CN" },
      "speed": { "type": "number", "default": 1.0, "description": "语速，0.5-2.0" },
      "output_format": { "type": "string", "enum": ["mp3", "wav", "ogg"], "default": "mp3" }
    },
    "required": ["text"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "audio_path": { "type": "string" },
      "duration_seconds": { "type": "number" }
    }
  }
}
```

**1.3 `tts.clone_synthesize`**

```json
{
  "name": "tts.clone_synthesize",
  "description": "基于参考音频克隆音色并合成语音（Index-TTS）",
  "inputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string", "description": "要合成的文本" },
      "reference_audio": { "type": "string", "description": "参考音频文件路径（用于音色克隆）" },
      "output_format": { "type": "string", "enum": ["mp3", "wav"], "default": "wav" }
    },
    "required": ["text", "reference_audio"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "audio_path": { "type": "string" },
      "duration_seconds": { "type": "number" }
    }
  }
}
```

**1.4 `asr.transcribe`**

```json
{
  "name": "asr.transcribe",
  "description": "将语音/音频文件转写为文字",
  "inputSchema": {
    "type": "object",
    "properties": {
      "audio_path": { "type": "string", "description": "音频文件路径" },
      "audio_base64": { "type": "string", "description": "Base64编码（与audio_path二选一）" },
      "language": { "type": "string", "default": "auto" },
      "timestamps": { "type": "boolean", "default": false, "description": "是否返回时间戳" },
      "speaker_diarization": { "type": "boolean", "default": false, "description": "是否区分说话人" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "text": { "type": "string" },
      "segments": { "type": "array", "description": "带时间戳的分段（如开启）" },
      "language_detected": { "type": "string" }
    }
  }
}
```

**1.5 `digital_human.generate`**

```json
{
  "name": "digital_human.generate",
  "description": "基于HeyGem生成数字人说话视频",
  "inputSchema": {
    "type": "object",
    "properties": {
      "avatar_id": { "type": "string", "description": "数字人形象ID" },
      "audio_path": { "type": "string", "description": "驱动音频路径（需先用tts生成）" },
      "text": { "type": "string", "description": "说话内容（如不提供audio_path则自动TTS）" },
      "background": { "type": "string", "description": "背景图片/视频路径，可选" },
      "resolution": { "type": "string", "enum": ["720p", "1080p"], "default": "1080p" }
    },
    "required": ["avatar_id"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "video_path": { "type": "string" },
      "duration_seconds": { "type": "number" },
      "task_id": { "type": "string", "description": "异步任务ID（生成较慢时返回）" }
    }
  },
  "async": true,
  "estimated_duration": "30s-5min"
}
```

**1.6 `document.parse`**

```json
{
  "name": "document.parse",
  "description": "MinerU智能文档解析，支持复杂PDF（含图表、公式、多栏排版）",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string" },
      "output_format": { "type": "string", "enum": ["markdown", "json", "html"], "default": "markdown" },
      "extract_images": { "type": "boolean", "default": true },
      "extract_tables": { "type": "boolean", "default": true },
      "ocr_enabled": { "type": "boolean", "default": true, "description": "对扫描件启用OCR" }
    },
    "required": ["file_path"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string" },
      "images": { "type": "array" },
      "tables": { "type": "array" },
      "metadata": { "type": "object" }
    }
  }
}
```

**1.7 `vision.analyze`**

```json
{
  "name": "vision.analyze",
  "description": "MiniCPM-o多模态理解：图片描述、图表分析、视频理解",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string", "description": "图片/视频文件路径" },
      "file_base64": { "type": "string" },
      "query": { "type": "string", "description": "针对该文件的提问" },
      "mode": { "type": "string", "enum": ["describe", "analyze", "qa"], "default": "qa" }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "answer": { "type": "string" },
      "confidence": { "type": "number" }
    }
  }
}
```

#### GPU 调度策略

由于多个模型共享 GPU，需要 GPU Scheduler：

```
GPU Scheduler 策略：
├── 常驻模型（长期占用 VRAM）
│   └── MiniCPM-o-4.5（多模态理解，调用频率高）
│
├── 按需加载模型（用时加载，空闲卸载）
│   ├── DeepSeek-OCR
│   ├── Qwen3-TTS / Index-TTS
│   ├── Qwen3-ASR
│   └── HeyGem
│
└── 调度规则
    ├── VRAM 水位监控，超 90% 不加载新模型
    ├── 空闲超过 N 分钟自动卸载（可配置）
    ├── 优先级队列：实时任务 > 批量任务
    └── 同类模型互斥（TTS 和 Clone-TTS 不同时加载）
```

---

### ■ 第 2 类：本地服务支持类（GPU-Backed Services）

**部署条件：** 需要 GPU 支持的非模型服务，是企业和个人用户的两大核心支柱

| # | Tool 名称 | 底层项目 | 功能 |
|---|-----------|---------|------|
| 2.1 | `sga_rag.*` | SGA-RAG（基于 RAGFlow） | 企业知识库：文档解析、向量检索、知识图谱 |
| 2.2 | `sga_matrix.*` | SGA-Matrix（基于 Doris） | 问数系统：自然语言查询数据库 |

#### 2.1 SGA-RAG Tool 集

```
sga_rag.search           — 语义检索 + 图谱增强检索
sga_rag.graph_query      — 知识图谱关系查询
sga_rag.upload           — 上传文档（自动解析、切片、embedding、入图谱）
sga_rag.upload_status    — 查询文档解析进度
sga_rag.list_collections — 列出所有知识库 collection
sga_rag.create_collection— 创建新的知识库 collection
sga_rag.delete_document  — 删除指定文档
sga_rag.promote          — 从 Claw 记忆提升内容到 RAG 知识库
sga_rag.summary          — 对指定 collection 或文档生成摘要
```

**详细 Schema（核心 Tool）：**

**`sga_rag.search`**

```json
{
  "name": "sga_rag.search",
  "description": "在企业知识库中进行语义检索，支持图谱增强",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "检索问题" },
      "collections": { "type": "array", "items": { "type": "string" }, "description": "指定知识库范围，空则搜全部已授权" },
      "top_k": { "type": "integer", "default": 5 },
      "use_graph": { "type": "boolean", "default": true, "description": "是否启用知识图谱增强" },
      "filters": {
        "type": "object",
        "description": "元数据过滤",
        "properties": {
          "doc_type": { "type": "string" },
          "date_from": { "type": "string" },
          "date_to": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "results": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "content": { "type": "string" },
            "source": { "type": "string" },
            "collection": { "type": "string" },
            "score": { "type": "number" },
            "metadata": { "type": "object" }
          }
        }
      },
      "graph_context": { "type": "string", "description": "图谱推理补充的上下文" }
    }
  }
}
```

**`sga_rag.upload`**

```json
{
  "name": "sga_rag.upload",
  "description": "上传文档到知识库，自动解析、切片、embedding、入图谱",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string" },
      "file_base64": { "type": "string" },
      "collection": { "type": "string", "description": "目标知识库" },
      "filename": { "type": "string" },
      "file_type": { "type": "string", "enum": ["pdf", "docx", "txt", "md", "html", "csv", "xlsx"] },
      "parse_mode": { "type": "string", "enum": ["auto", "ocr", "text"], "default": "auto" },
      "build_graph": { "type": "boolean", "default": true, "description": "是否同时构建知识图谱" },
      "tags": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["collection", "filename", "file_type"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "doc_id": { "type": "string" },
      "task_id": { "type": "string", "description": "异步解析任务ID" },
      "status": { "type": "string", "enum": ["queued", "parsing", "completed", "failed"] }
    }
  },
  "async": true
}
```

**`sga_rag.graph_query`**

```json
{
  "name": "sga_rag.graph_query",
  "description": "知识图谱关系查询，适合多跳推理问题",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "自然语言关系查询" },
      "entity": { "type": "string", "description": "起始实体（可选，精确查询）" },
      "relation_type": { "type": "string", "description": "关系类型筛选" },
      "max_hops": { "type": "integer", "default": 2, "description": "最大跳数" },
      "collection": { "type": "string" }
    },
    "required": ["query"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "entities": { "type": "array" },
      "relations": { "type": "array" },
      "answer": { "type": "string", "description": "基于图谱的推理回答" },
      "subgraph": { "type": "object", "description": "相关子图（可视化用）" }
    }
  }
}
```

#### 2.2 SGA-Matrix Tool 集（问数系统）

```
sga_matrix.query         — 自然语言查询数据库
sga_matrix.list_datasets — 列出可查询的数据集/表
sga_matrix.get_schema    — 获取表结构
sga_matrix.execute_sql   — 直接执行SQL（需高级权限）
sga_matrix.create_chart  — 基于查询结果生成图表
sga_matrix.export        — 导出查询结果为 CSV/Excel
```

**`sga_matrix.query`（核心 Tool）**

```json
{
  "name": "sga_matrix.query",
  "description": "自然语言查询企业数据库（基于Doris），自动生成SQL并执行",
  "inputSchema": {
    "type": "object",
    "properties": {
      "question": { "type": "string", "description": "自然语言查询，如：上个月销售额最高的产品是什么" },
      "dataset": { "type": "string", "description": "指定数据集，空则自动匹配" },
      "return_sql": { "type": "boolean", "default": false, "description": "是否同时返回生成的SQL" },
      "max_rows": { "type": "integer", "default": 100 },
      "output_format": { "type": "string", "enum": ["table", "json", "csv"], "default": "table" }
    },
    "required": ["question"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "data": { "type": "array" },
      "columns": { "type": "array" },
      "row_count": { "type": "integer" },
      "sql": { "type": "string" },
      "explanation": { "type": "string", "description": "对结果的自然语言解释" }
    }
  }
}
```

---

### ■ 第 3 类：系统耦合连接类（Enterprise System Integration）

**部署条件：** 需要企业提供系统账号和 API 接入权限，鉴权在 MCP Hub 内完成

**特殊要求：** 这类 Tool 涉及企业核心业务和资金，安全级别最高，需要：
- 操作审计日志（每次调用记录完整入参出参）
- 敏感字段脱敏（银行账号、金额等在日志中脱敏）
- 二次确认机制（涉及资金操作时需用户确认）

| # | Tool 名称 | 对接系统 | 功能 |
|---|-----------|---------|------|
| 3.1 | `yonyou.*` | 用友 ERP | 财务、采购、库存、销售等 |
| 3.2 | `cmb_payroll.*` | 招行薪福通 | 薪资发放、查询 |
| 3.3 | `bank_enterprise.*` | 银企直联 | 银行账户查询、转账、回单 |
| 3.4 | `qiqi.*` | 企企 | 项目管理、费用报销 |

#### 3.1 用友 ERP Tool 集

```
yonyou.query_voucher       — 查询凭证
yonyou.create_voucher      — 创建凭证（需确认）
yonyou.query_inventory     — 查询库存
yonyou.query_sales_order   — 查询销售订单
yonyou.create_sales_order  — 创建销售订单（需确认）
yonyou.query_purchase      — 查询采购订单
yonyou.create_purchase     — 创建采购订单（需确认）
yonyou.query_receivable    — 查询应收
yonyou.query_payable       — 查询应付
yonyou.get_report          — 获取财务报表
yonyou.query_customer      — 查询客户档案
yonyou.query_supplier      — 查询供应商档案
```

#### 3.2 招行薪福通 Tool 集

```
cmb_payroll.query_batch        — 查询薪资批次列表
cmb_payroll.query_detail       — 查询某批次明细
cmb_payroll.create_batch       — 创建薪资发放批次（需确认）
cmb_payroll.submit_batch       — 提交批次发放（需二次确认）
cmb_payroll.query_status       — 查询发放状态
cmb_payroll.download_receipt   — 下载发放回单
```

#### 3.3 银企直联 Tool 集

```
bank_enterprise.query_balance   — 查询账户余额
bank_enterprise.query_statement — 查询账户流水
bank_enterprise.transfer        — 发起转账（需二次确认）
bank_enterprise.query_transfer  — 查询转账状态
bank_enterprise.download_receipt— 下载电子回单
```

#### 3.4 企企 Tool 集

```
qiqi.query_project          — 查询项目列表/详情
qiqi.query_expense          — 查询费用报销单
qiqi.create_expense         — 创建费用报销单
qiqi.approve_expense        — 审批费用报销（需确认）
qiqi.query_budget           — 查询预算执行情况
```

#### 安全机制设计

```
┌─────────────────────────────────────────┐
│        系统耦合类安全层                    │
│                                          │
│  1. 鉴权层（Auth Gate）                   │
│     ├── 各系统 API Key / Token 加密存储    │
│     ├── Token 自动续期                     │
│     └── 登录态会话管理                     │
│                                          │
│  2. 权限层（RBAC）                        │
│     ├── 查询类：普通权限                    │
│     ├── 创建类：需 write 权限               │
│     └── 资金类：需 finance 权限 + 二次确认   │
│                                          │
│  3. 审计层（Audit Log）                    │
│     ├── 每次调用记录完整日志                 │
│     ├── 敏感字段自动脱敏                    │
│     └── 日志不可篡改（append-only）          │
│                                          │
│  4. 确认机制                               │
│     ├── 涉及资金操作 → 强制二次确认           │
│     ├── 创建/修改操作 → 可配置是否确认        │
│     └── 确认通过渠道回传用户（微信/Web）      │
└─────────────────────────────────────────┘
```

---

### ■ 第 4 类：新媒体预处理类（Media Generation & Processing）

**部署条件：** 部分需要本地 GPU（Seedream、Qwen3-Image），部分调用外部 API（Google Nano、Banana）

| # | Tool 名称 | 底层项目 | 功能 |
|---|-----------|---------|------|
| 4.1 | `image.generate` | Seedream | 文生图 |
| 4.2 | `image.generate_qwen` | Qwen3-Image | 文生图（本地） |
| 4.3 | `image.edit` | Google Nano / Banana | AI 改图 |
| 4.4 | `image.fusion` | 多图融合服务 | 多图融合/风格迁移 |
| 4.5 | `image.upscale` | 超分辨率模型 | 图片放大增强 |
| 4.6 | `image.remove_bg` | 背景移除 | 智能抠图 |

#### Tool 集

```
image.generate        — 文生图（指定引擎：seedream / qwen3）
image.edit            — AI改图（局部修改、风格变换）
image.fusion          — 多图融合
image.upscale         — 图片超分辨率放大
image.remove_bg       — 智能抠图/背景移除
image.describe        — 图片描述（复用 vision.analyze）
image.compress        — 图片压缩/格式转换
image.batch_process   — 批量图片处理
```

**`image.generate`**

```json
{
  "name": "image.generate",
  "description": "AI文生图，支持多种引擎",
  "inputSchema": {
    "type": "object",
    "properties": {
      "prompt": { "type": "string", "description": "图片描述" },
      "negative_prompt": { "type": "string", "description": "不希望出现的内容" },
      "engine": { "type": "string", "enum": ["seedream", "qwen3", "auto"], "default": "auto" },
      "width": { "type": "integer", "default": 1024 },
      "height": { "type": "integer", "default": 1024 },
      "style": { "type": "string", "description": "风格预设" },
      "num_images": { "type": "integer", "default": 1, "maximum": 4 },
      "seed": { "type": "integer", "description": "随机种子（可复现）" }
    },
    "required": ["prompt"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "images": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "path": { "type": "string" },
            "width": { "type": "integer" },
            "height": { "type": "integer" },
            "seed": { "type": "integer" }
          }
        }
      }
    }
  },
  "async": true,
  "estimated_duration": "10s-60s"
}
```

---

### ■ 第 5 类：视频生成类（Video Generation）

**部署条件：** 主要依赖外部 API（Sora、Seedance），高成本、长耗时

| # | Tool 名称 | 底层项目 | 功能 |
|---|-----------|---------|------|
| 5.1 | `video.generate` | Seedance / Sora | AI 文/图生视频 |
| 5.2 | `video.edit` | 视频编辑服务 | AI 视频编辑 |

#### Tool 集

```
video.generate          — 文生视频 / 图生视频
video.query_status      — 查询生成任务状态
video.extend            — 视频延长
video.combine           — 多段视频拼接
video.add_subtitle      — 自动加字幕（结合 ASR）
video.add_audio         — 添加音频/配乐
video.extract_frames    — 提取关键帧
```

**`video.generate`**

```json
{
  "name": "video.generate",
  "description": "AI视频生成，支持文生视频和图生视频",
  "inputSchema": {
    "type": "object",
    "properties": {
      "prompt": { "type": "string", "description": "视频描述" },
      "reference_image": { "type": "string", "description": "参考图片路径（图生视频）" },
      "engine": { "type": "string", "enum": ["seedance", "sora", "auto"], "default": "auto" },
      "duration": { "type": "integer", "default": 5, "description": "视频时长（秒）" },
      "resolution": { "type": "string", "enum": ["720p", "1080p"], "default": "1080p" },
      "aspect_ratio": { "type": "string", "enum": ["16:9", "9:16", "1:1"], "default": "16:9" }
    },
    "required": ["prompt"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "task_id": { "type": "string" },
      "status": { "type": "string" },
      "video_path": { "type": "string" },
      "estimated_wait": { "type": "integer", "description": "预估等待秒数" }
    }
  },
  "async": true,
  "estimated_duration": "1min-10min"
}
```

---

### ■ 第 6 类：信息收集类（Information Gathering）

**部署条件：** 本地部署，需要公网出口

| # | Tool 名称 | 底层项目 | 功能 |
|---|-----------|---------|------|
| 6.1 | `sga_web.*` | SGA-Web（基于 SearXNG） | 网络搜索引擎 |
| 6.2 | `sga_hotnews.*` | SGA-Hotnews | 热点资讯收集 |
| 6.3 | `catfish.*` | Catfish | 舆情监控 |

#### 6.1 SGA-Web Tool 集

```
sga_web.search            — 网络搜索
sga_web.fetch_page        — 抓取网页内容（自动解析为 Markdown）
sga_web.search_images     — 图片搜索
sga_web.search_news       — 新闻搜索
sga_web.search_academic   — 学术论文搜索
```

**`sga_web.search`**

```json
{
  "name": "sga_web.search",
  "description": "网络搜索，基于SearXNG聚合多个搜索引擎结果",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": { "type": "string" },
      "num_results": { "type": "integer", "default": 10 },
      "language": { "type": "string", "default": "zh-CN" },
      "time_range": { "type": "string", "enum": ["day", "week", "month", "year", "all"], "default": "all" },
      "categories": { "type": "array", "items": { "type": "string" }, "description": "搜索类别：general/news/images/science" }
    },
    "required": ["query"]
  }
}
```

#### 6.2 SGA-Hotnews Tool 集

```
sga_hotnews.get_trending     — 获取当前热点（分平台：微博/知乎/头条/百度等）
sga_hotnews.get_by_topic     — 按话题获取相关资讯
sga_hotnews.subscribe        — 订阅关键词，有新热点时通知
sga_hotnews.get_summary      — 获取某热点事件的综合摘要
```

#### 6.3 Catfish Tool 集（舆情监控）

```
catfish.monitor_add          — 添加舆情监控关键词
catfish.monitor_list         — 查看当前监控列表
catfish.get_alerts           — 获取舆情预警
catfish.get_sentiment        — 获取某话题的情感分析
catfish.get_report           — 生成舆情分析报告
catfish.get_trend            — 获取关键词传播趋势
```

---

### ■ 第 7 类：办公文档类（Office Document Generation）

**部署条件：** 纯 CPU，本地运行

| # | Tool 名称 | 功能 |
|---|-----------|------|
| 7.1 | `doc.create` | 生成 Word 文档 |
| 7.2 | `doc.pdf_create` | 生成 PDF |
| 7.3 | `doc.excel_create` | 生成 Excel |
| 7.4 | `doc.ppt_create` | 生成 PPT |
| 7.5 | `doc.convert` | 格式互转 |
| 7.6 | `doc.merge_pdf` | PDF 合并/拆分 |
| 7.7 | `doc.fill_template` | 模板填充 |

#### Tool 集

```
doc.create              — 根据内容和模板生成Word文档
doc.pdf_create          — 生成PDF（从Markdown/HTML/Word转换）
doc.excel_create        — 生成Excel（支持多sheet、图表、公式）
doc.ppt_create          — 生成PPT（支持模板、多种布局）
doc.convert             — 文档格式转换（docx↔pdf↔html↔md）
doc.merge_pdf           — PDF合并/拆分/加水印
doc.fill_template       — 基于模板和数据填充文档（适合批量生成合同、报告）
doc.read                — 读取文档内容（返回结构化文本）
```

**`doc.create`**

```json
{
  "name": "doc.create",
  "description": "根据内容生成Word文档，支持模板和自定义样式",
  "inputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "文档内容（Markdown格式）" },
      "template_id": { "type": "string", "description": "模板ID（可选）" },
      "title": { "type": "string" },
      "filename": { "type": "string", "default": "document.docx" },
      "styles": {
        "type": "object",
        "description": "自定义样式",
        "properties": {
          "font": { "type": "string", "default": "微软雅黑" },
          "font_size": { "type": "integer", "default": 12 },
          "header_logo": { "type": "string", "description": "页眉Logo路径" },
          "footer_text": { "type": "string" }
        }
      },
      "page_size": { "type": "string", "enum": ["A4", "Letter"], "default": "A4" }
    },
    "required": ["content"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "file_path": { "type": "string" },
      "page_count": { "type": "integer" }
    }
  }
}
```

---

### ■ 第 8 类：企业微信功能类（WeCom Integration）

**部署条件：** 需要企业微信管理员授权 + API 接入配置

**特殊要求：** 这类 Tool 是 SGA-Molt 的核心交互渠道，不仅是"通知"，更是"与用户双向协作"的入口。

| # | Tool 名称 | 内部代号 | 功能 |
|---|-----------|---------|------|
| 8.1 | `sga_phone.*` | SGA-Phone | 企业微信消息单发/群发 |
| 8.2 | `sga_meeting.*` | SGA-Meeting | 腾讯会议管理 |
| 8.3 | `sga_mail.*` | SGA-Mail | 企业微信邮箱 |
| 8.4 | `sga_calendar.*` | SGA-Calendar | 企业微信日历/日程 |
| 8.5 | `sga_remind.*` | SGA-Remind | 企业微信提醒系统 |

#### 8.1 SGA-Phone Tool 集（消息系统）

```
sga_phone.send_text          — 发送文本消息（指定用户/群）
sga_phone.send_image         — 发送图片消息
sga_phone.send_file          — 发送文件
sga_phone.send_video         — 发送视频
sga_phone.send_card          — 发送图文卡片
sga_phone.send_markdown      — 发送Markdown消息
sga_phone.send_template      — 发送模板消息
sga_phone.batch_send         — 批量群发（指定用户列表/标签/部门）
sga_phone.get_contacts       — 获取通讯录（部门/人员列表）
sga_phone.get_group_list     — 获取群列表
sga_phone.create_group       — 创建群聊
```

**`sga_phone.send_text`**

```json
{
  "name": "sga_phone.send_text",
  "description": "通过企业微信发送文本消息",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": {
        "type": "object",
        "properties": {
          "user_ids": { "type": "array", "items": { "type": "string" } },
          "group_id": { "type": "string" },
          "department_ids": { "type": "array", "items": { "type": "string" } },
          "tag_ids": { "type": "array", "items": { "type": "string" } }
        },
        "description": "接收者（user_ids/group_id/department_ids/tag_ids 至少一个）"
      },
      "content": { "type": "string" },
      "mention_all": { "type": "boolean", "default": false },
      "mention_users": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["to", "content"]
  }
}
```

#### 8.2 SGA-Meeting Tool 集（腾讯会议）

```
sga_meeting.create           — 创建会议（预定腾讯会议）
sga_meeting.update           — 修改会议信息
sga_meeting.cancel           — 取消会议
sga_meeting.list_upcoming    — 查询即将到来的会议
sga_meeting.get_detail       — 获取会议详情（含参会人、会议链接）
sga_meeting.get_recording    — 获取会议录制（如有）
sga_meeting.invite           — 邀请参会人
```

**`sga_meeting.create`**

```json
{
  "name": "sga_meeting.create",
  "description": "预定腾讯会议",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "start_time": { "type": "string", "format": "date-time" },
      "end_time": { "type": "string", "format": "date-time" },
      "invitees": { "type": "array", "items": { "type": "string" }, "description": "参会人企微用户ID列表" },
      "description": { "type": "string" },
      "password": { "type": "string", "description": "会议密码（可选）" },
      "enable_recording": { "type": "boolean", "default": false },
      "reminder_minutes": { "type": "integer", "default": 15, "description": "提前N分钟提醒" }
    },
    "required": ["title", "start_time", "end_time"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "meeting_id": { "type": "string" },
      "meeting_url": { "type": "string" },
      "meeting_code": { "type": "string" },
      "password": { "type": "string" }
    }
  }
}
```

#### 8.3 SGA-Mail Tool 集（企业微信邮箱）

```
sga_mail.list_inbox          — 获取收件箱列表
sga_mail.get_mail            — 获取邮件详情（含正文、附件列表）
sga_mail.download_attachment — 下载邮件附件
sga_mail.send                — 发送邮件
sga_mail.reply               — 回复邮件
sga_mail.forward             — 转发邮件
sga_mail.search              — 搜索邮件
sga_mail.summarize_inbox     — 智能摘要收件箱（今日未读邮件摘要）
sga_mail.organize            — 智能整理邮件（分类、标记重要、归档）
```

**`sga_mail.list_inbox`**

```json
{
  "name": "sga_mail.list_inbox",
  "description": "获取企业微信邮箱收件箱列表",
  "inputSchema": {
    "type": "object",
    "properties": {
      "folder": { "type": "string", "enum": ["inbox", "sent", "draft", "archive", "trash"], "default": "inbox" },
      "unread_only": { "type": "boolean", "default": false },
      "from_filter": { "type": "string", "description": "按发件人过滤" },
      "subject_filter": { "type": "string", "description": "按主题关键词过滤" },
      "date_from": { "type": "string", "format": "date" },
      "date_to": { "type": "string", "format": "date" },
      "page": { "type": "integer", "default": 1 },
      "page_size": { "type": "integer", "default": 20 }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "mails": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "mail_id": { "type": "string" },
            "from": { "type": "string" },
            "subject": { "type": "string" },
            "date": { "type": "string" },
            "is_read": { "type": "boolean" },
            "has_attachment": { "type": "boolean" },
            "preview": { "type": "string" }
          }
        }
      },
      "total_count": { "type": "integer" }
    }
  }
}
```

#### 8.4 SGA-Calendar Tool 集（日历/日程）

```
sga_calendar.list_events      — 查询日程列表（按时间范围）
sga_calendar.get_event        — 获取日程详情
sga_calendar.create_event     — 创建日程
sga_calendar.update_event     — 修改日程
sga_calendar.delete_event     — 删除日程
sga_calendar.check_free_busy  — 查询忙闲状态（指定人/时间段）
sga_calendar.find_slot        — 智能找时间（多人共同空闲时段）
sga_calendar.daily_brief      — 今日日程简报
```

**`sga_calendar.create_event`**

```json
{
  "name": "sga_calendar.create_event",
  "description": "在企业微信日历中创建日程",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "start_time": { "type": "string", "format": "date-time" },
      "end_time": { "type": "string", "format": "date-time" },
      "all_day": { "type": "boolean", "default": false },
      "location": { "type": "string" },
      "description": { "type": "string" },
      "attendees": { "type": "array", "items": { "type": "string" }, "description": "参与人企微用户ID" },
      "reminder_minutes": { "type": "array", "items": { "type": "integer" }, "default": [15], "description": "提前提醒时间" },
      "recurrence": {
        "type": "object",
        "description": "重复规则",
        "properties": {
          "type": { "type": "string", "enum": ["daily", "weekly", "monthly"] },
          "interval": { "type": "integer", "default": 1 },
          "end_date": { "type": "string", "format": "date" }
        }
      }
    },
    "required": ["title", "start_time", "end_time"]
  }
}
```

#### 8.5 SGA-Remind Tool 集（提醒系统）

```
sga_remind.create            — 创建提醒
sga_remind.list              — 查看提醒列表
sga_remind.update            — 修改提醒
sga_remind.delete            — 删除提醒
sga_remind.snooze            — 延后提醒
```

**`sga_remind.create`**

```json
{
  "name": "sga_remind.create",
  "description": "创建企业微信提醒",
  "inputSchema": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "提醒内容" },
      "remind_time": { "type": "string", "format": "date-time", "description": "提醒时间" },
      "target_users": { "type": "array", "items": { "type": "string" }, "description": "提醒对象（默认自己）" },
      "repeat": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["once", "daily", "weekly", "monthly", "workday"] },
          "end_date": { "type": "string", "format": "date" }
        }
      },
      "priority": { "type": "string", "enum": ["low", "normal", "high", "urgent"], "default": "normal" }
    },
    "required": ["content", "remind_time"]
  }
}
```

---

## 三、MCP Hub 基础设施模块

除了上面的 8 类业务 Tool，MCP Hub 本身还需要以下基础设施：

### 3.1 Tool Registry（工具注册中心）

```
功能：
├── 所有 Tool 的注册和发现
├── Tool Schema 管理（入参、出参、描述）
├── Tool 分类和标签
├── Tool 版本管理
├── Tool 启用/禁用开关
└── 向 Claw 暴露 tools/list 接口

存储：SQLite 或 JSON 文件
接口：MCP 标准 tools/list
```

### 3.2 Auth Gate（统一鉴权中心）

```
功能：
├── 各外部系统的凭证加密存储（AES-256）
├── API Key / OAuth Token / Session 管理
├── Token 自动续期和刷新
├── 凭证健康检查
└── 凭证配置界面（Claw 前端通过 API 调用）

支持的鉴权类型：
├── API Key（用友、SearXNG 等）
├── OAuth 2.0（企业微信、腾讯会议等）
├── 银企直联证书（USB Key / 数字证书）
├── Session Cookie（部分老系统）
└── 自定义 Header（招行等）
```

### 3.3 GPU Scheduler（GPU 资源调度）

```
功能：
├── VRAM 实时监控
├── 模型加载/卸载管理
├── 推理请求排队
├── 优先级调度
├── 常驻模型 vs 按需加载配置
└── OOM 防护（VRAM 超 90% 拒绝新模型加载）

调度策略：
├── 实时请求（OCR、ASR）→ 高优先级
├── 交互请求（TTS、图片生成）→ 中优先级
├── 批量请求（视频生成、文档解析）→ 低优先级
└── 同类互斥（避免两个大模型同时加载）
```

### 3.4 Async Task Queue（异步任务队列）

```
适用场景：
├── 视频生成（1-10分钟）
├── 数字人生成（30秒-5分钟）
├── 大文档解析（RAG 入库）
├── 批量群发
└── 舆情报告生成

功能：
├── 任务提交 → 返回 task_id
├── 任务状态查询（pending/running/completed/failed）
├── 任务进度上报
├── 任务超时和重试
├── 任务结果存储和回调
└── 向 Claw 推送任务完成事件

接口：
├── task.submit    — 提交任务
├── task.status    — 查询状态
├── task.cancel    — 取消任务
├── task.result    — 获取结果
└── task.list      — 列出任务
```

### 3.5 File Storage（文件中转存储）

```
场景：
├── TTS 生成的音频文件
├── 图片/视频生成的文件
├── 文档生成的文件
├── 邮件附件下载
└── 跨 Tool 文件传递（OCR识别 → RAG入库）

功能：
├── 临时文件存储（自动过期清理）
├── 文件引用 ID（file_id）供跨 Tool 传递
├── 文件元信息（类型、大小、来源 Tool）
└── 存储路径：/data/mcp-hub/files/<date>/<file_id>
```

---

## 四、全量 Tool 统计

| 类别 | MCP Server 数 | Tool 数量 | GPU | 优先级 |
|------|--------------|----------|-----|--------|
| 1. 本地算力模型类 | 7 | ~10 | 必须 | P0（核心能力） |
| 2. 本地服务支持类 | 2 | ~20 | 必须 | P0（核心基础设施） |
| 3. 系统耦合连接类 | 4+ | ~25 | 无 | P1（按客户需求） |
| 4. 新媒体预处理类 | 3-5 | ~8 | 部分 | P1 |
| 5. 视频生成类 | 2 | ~7 | 外部API | P2 |
| 6. 信息收集类 | 3 | ~15 | 无 | P0 |
| 7. 办公文档类 | 1 | ~8 | 无 | P0 |
| 8. 企业微信功能类 | 5 | ~35 | 无 | P0 |
| **Hub 基础设施** | 5 | — | — | **P0** |
| **合计** | **~35** | **~128** | — | — |

---

## 五、实施优先级和里程碑

### M1（第 1-4 周）：跑通核心链路

**目标：一个完整的 demo 能跑起来**

```
Hub 基础设施：
  ✅ Tool Registry（基础版）
  ✅ Auth Gate（基础版）
  ✅ File Storage
  ✅ Async Task Queue（基础版）

业务 Tool：
  ✅ 第 2 类：sga_rag.search / upload / graph_query
  ✅ 第 2 类：sga_matrix.query / list_datasets
  ✅ 第 7 类：doc.create / pdf_create / excel_create / ppt_create
  ✅ 第 8 类：sga_phone.send_text / send_file / get_contacts
  ✅ 第 6 类：sga_web.search / fetch_page
```

### M2（第 5-8 周）：企业级能力补齐

**目标：可以给第一个企业客户试用**

```
Hub 基础设施：
  ✅ GPU Scheduler
  ✅ Auth Gate 完整版（OAuth、证书等）
  ✅ 审计日志

业务 Tool：
  ✅ 第 1 类：ocr.recognize / tts.synthesize / asr.transcribe
  ✅ 第 1 类：document.parse (MinerU)
  ✅ 第 3 类：用友 ERP 基础查询 Tool（按客户需求）
  ✅ 第 8 类：sga_mail 全套 / sga_calendar 全套 / sga_remind 全套
  ✅ 第 8 类：sga_meeting 全套
  ✅ 第 6 类：sga_hotnews / catfish 基础版
```

### M3（第 9-12 周）：能力扩展

**目标：完善多媒体和高级功能**

```
业务 Tool：
  ✅ 第 1 类：tts.clone_synthesize (Index-TTS)
  ✅ 第 1 类：digital_human.generate (HeyGem)
  ✅ 第 1 类：vision.analyze (MiniCPM-o)
  ✅ 第 3 类：更多 ERP 系统（按客户需求）
  ✅ 第 3 类：银企直联 / 招行薪福通
  ✅ 第 4 类：image.generate / edit / fusion
  ✅ 第 5 类：video.generate (Seedance / Sora)
```

---

## 六、与 Claw 侧的接口约定

| 接口 | 方向 | 协议 | 说明 |
|------|------|------|------|
| `tools/list` | Claw → Hub | MCP (JSON-RPC) | 获取所有已注册 Tool 列表 + Schema |
| `tools/call` | Claw → Hub | MCP (JSON-RPC) | 调用指定 Tool |
| `task.status` | Claw → Hub | MCP (JSON-RPC) | 查询异步任务状态 |
| `task.result` | Claw → Hub | MCP (JSON-RPC) | 获取异步任务结果 |
| `health` | Claw → Hub | HTTP | Hub 和各 MCP Server 健康状态 |
| `event.push` | Hub → Claw | WebSocket | 异步任务完成通知、舆情预警等推送 |

**通信方式：** 本地 stdio 或 HTTP（同机部署），MCP Hub 监听端口待定（建议 18800）

---

## 七、开放问题

1. **GPU 显卡配置：** 4090（24GB）还是 5090？单卡还是多卡？决定了能同时跑多少模型。
2. **外部 API 成本预算：** Sora、Seedance 等按调用计费，需要预估月度用量。
3. **企业微信 API 权限范围：** 不同企业的管理员授权范围不同，需要按客户梳理。
4. **ERP 对接工作量：** 用友版本不同，API 差异大，可能需要按客户定制。
5. **MCP Hub 是否开源？** 还是作为 SGA-Molt 的商业核心闭源？

---

*本文档为 MCP Hub 侧全量需求，Claw 侧需求见《SGA-Molt-Requirements.md》。*
*两份文档需配合阅读，有任何接口对齐问题随时沟通。*
