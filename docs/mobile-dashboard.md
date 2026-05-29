# proposal-writer-demo 手机版 Dashboard

> 本地优先的企业内部议案/请示写作工作台 Demo，支持模板库、AI 起草、内容编辑、上传识别、格式检查和导出。

## 总览

| 指标 | 数量 | 说明 |
| --- | --- | --- |
| 分析文件 | 38 | 进入知识图谱的文件 |
| 图谱节点 | 128 | 文件、配置、文档、函数 |
| 关系连线 | 211 | 导入、调用、转换等 |
| 架构层 | 7 | 按职责分组 |
| 导览步骤 | 7 | 推荐阅读路径 |

## 技术栈

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- Tiptap

## 架构层

### 文档与试用说明

说明项目定位、使用方法、数据隐私和网页试用包。

文件数：2

### 构建与工程配置

定义依赖、构建、类型检查、样式处理和入口 HTML。

文件数：6

### 应用外壳与国际化

负责应用启动、顶层布局、全局样式、右侧工具栏和中英文文案。

文件数：7

### A4 议案渲染与模板

负责内置模板、格式标准、A4 预览和正文板块显示。

文件数：4

### 侧边栏编辑与基础控件

负责模板库、工坊、AI 起草、内容编辑、导出面板和基础 UI 组件。

文件数：7

### 状态管理与业务模型

定义议案、模板、AI 配置等业务数据结构，并集中管理本地状态。

文件数：3

### 本地服务、AI 与工具函数

负责 BYOK AI 调用、本地存储、格式检查、模板识别、内容转换、标题拆分和单文件导出。

文件数：9

## 主流程

1. main.tsx 启动 React 应用并加载全局样式与国际化。
2. App.tsx 组合 A4 预览、右侧工具栏和侧边栏。
3. Zustand Store 集中管理模板、正文、AI 配置和本地持久化。
4. Services 处理 AI 起草、局部改写、模板识别、格式检查和导出。
5. Proposal Preview 将当前文档渲染为 A4 公文页面。

## 关键文件

### src/main.tsx

前端入口，初始化 i18n、加载样式，并把 App 挂载到页面。

### src/App.tsx

应用主框架，组合顶部状态、A4 预览、右侧工具栏和侧边栏。

### src/store/proposal.ts

Zustand 全局状态中心，管理文档、模板、AI 配置、模板识别和导出消息。

### src/components/Editor/index.tsx

侧边栏功能集合，包含模板库、模板工坊、AI 起草、内容编辑、检查、导出和外观控制。

### src/components/Proposal/index.tsx

A4 公文预览组件，将当前议案渲染成标题、主送、正文、附件和落款。

### src/services/ai.ts

AI 服务层，封装 OpenAI-compatible URL、AI 起草、模拟草稿和局部改写。

### src/services/templateRecognition.ts

模板识别服务，从 DOCX/Markdown/PDF 提取文本并生成模板草稿，可选 BYOK 增强。

### src/utils/documentSplit.ts

文档拆分工具，按中文公文一级标题或 Markdown 标题拆分正文板块。

### scripts/make-standalone-web.mjs

单文件网页导出脚本，把构建产物中的 CSS/JS 内联到 index.html。

### README.md

项目总说明文档，介绍本地优先、模板库、AI 起草、内容编辑、导出和后续路线。

## 阅读导览

1. 先理解产品目标

   从 README 了解这是一个本地优先的议案/请示生成工作台，以及它为什么强调本地保存、模板和 BYOK。

2. 看应用如何启动

   main.tsx 挂载 React 应用，App.tsx 组合顶部状态、A4 预览、工具栏和侧边栏。

3. 掌握状态和数据模型

   先看类型定义，再看 Zustand store 如何把模板、正文、AI 配置和本地保存连接起来。

4. 理解模板到 A4 预览

   模板文件定义内置模板和格式标准，ProposalView 负责把当前文档渲染成公文页面。

5. 理解侧边栏工作台

   Toolbar 打开不同抽屉，Editor/index.tsx 承载模板库、模板工坊、AI 起草、内容编辑、格式检查和导出面板。

6. 理解 AI 和上传识别

   AI 服务处理 OpenAI-compatible 调用和局部改写，模板识别服务负责从 DOCX/MD/PDF 提取并识别结构。

7. 理解导出和单文件分发

   proposal 服务导出 Markdown，独立脚本把 Vite 构建产物内联成可发给同事试用的 index.html。

## 关系统计

| 关系类型 | 数量 |
| --- | --- |
| contains | 90 |
| imports | 63 |
| exports | 38 |
| calls | 9 |
| configures | 5 |
| transforms | 2 |
| documents | 2 |
| writes_to | 1 |
| defines_schema | 1 |
