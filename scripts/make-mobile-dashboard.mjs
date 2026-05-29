import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const graphPath = join(root, ".understand-anything", "knowledge-graph.json");
const outDir = join(root, "docs");
const htmlPath = join(outDir, "mobile-dashboard.html");
const mdPath = join(outDir, "mobile-dashboard.md");

const graph = JSON.parse(await readFile(graphPath, "utf8"));

const fileLevelTypes = new Set([
  "file",
  "config",
  "document",
  "service",
  "pipeline",
  "table",
  "schema",
  "resource",
  "endpoint",
]);

const fileNodes = graph.nodes.filter((node) => fileLevelTypes.has(node.type));
const functionNodes = graph.nodes.filter((node) => node.type === "function");
const edgeTypeCounts = countBy(graph.edges, (edge) => edge.type);
const nodeTypeCounts = countBy(graph.nodes, (node) => node.type);

const keyFileIds = [
  "file:src/main.tsx",
  "file:src/App.tsx",
  "file:src/store/proposal.ts",
  "file:src/components/Editor/index.tsx",
  "file:src/components/Proposal/index.tsx",
  "file:src/services/ai.ts",
  "file:src/services/templateRecognition.ts",
  "file:src/utils/documentSplit.ts",
  "file:scripts/make-standalone-web.mjs",
  "document:README.md",
];

const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
const keyFiles = keyFileIds.map((id) => nodeById.get(id)).filter(Boolean);

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = selector(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function maxValue(record) {
  return Math.max(1, ...Object.values(record));
}

function statCard(label, value, note) {
  return `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function barRows(record) {
  const max = maxValue(record);
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      const width = Math.max(6, Math.round((value / max) * 100));
      return `<div class="bar-row"><span>${escapeHtml(name)}</span><div class="bar-track"><i style="width:${width}%"></i></div><b>${value}</b></div>`;
    })
    .join("");
}

function layerRows() {
  const max = Math.max(1, ...graph.layers.map((layer) => layer.nodeIds.length));
  return graph.layers
    .map((layer) => {
      const width = Math.max(8, Math.round((layer.nodeIds.length / max) * 100));
      return `<article class="layer-card">
        <div class="layer-head"><strong>${escapeHtml(layer.name)}</strong><span>${layer.nodeIds.length} 个文件</span></div>
        <p>${escapeHtml(layer.description)}</p>
        <div class="bar-track layer-track"><i style="width:${width}%"></i></div>
      </article>`;
    })
    .join("");
}

function fileCards() {
  return keyFiles
    .map((node) => `<article class="file-card">
      <code>${escapeHtml(node.filePath)}</code>
      <h3>${escapeHtml(node.name)}</h3>
      <p>${escapeHtml(node.summary)}</p>
      <div class="tags">${node.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
    </article>`)
    .join("");
}

function tourCards() {
  return graph.tour
    .map((step) => `<article class="tour-card">
      <span class="step">${String(step.order).padStart(2, "0")}</span>
      <div>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.description)}</p>
      </div>
    </article>`)
    .join("");
}

function mdTable(rows) {
  const [head, ...body] = rows;
  const header = `| ${head.map((cell) => String(cell).replace(/\n/g, " ")).join(" | ")} |`;
  const separator = `| ${head.map(() => "---").join(" | ")} |`;
  return [header, separator, ...body.map((row) => `| ${row.map((cell) => String(cell).replace(/\n/g, " ")).join(" | ")} |`)].join("\n");
}

const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(graph.project.name)} 手机 Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17211c;
        --muted: #65736b;
        --line: #dce5df;
        --paper: #fbfdfb;
        --wash: #edf7f1;
        --green: #1f6b50;
        --blue: #225fb8;
        --amber: #b66a13;
        --shadow: 0 16px 42px rgba(23, 33, 28, 0.11);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--ink);
        background: linear-gradient(180deg, #f4faf6 0%, #ffffff 42%, #f7faf8 100%);
        line-height: 1.55;
      }
      .shell { max-width: 760px; margin: 0 auto; padding: 18px 14px 48px; }
      .hero {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.86);
        box-shadow: var(--shadow);
        padding: 22px 18px;
        position: sticky;
        top: 0;
        z-index: 2;
        backdrop-filter: blur(16px);
      }
      .eyebrow { margin: 0 0 8px; font-size: 12px; color: var(--green); font-weight: 800; letter-spacing: 0; }
      h1 { margin: 0; font-size: clamp(28px, 8vw, 44px); line-height: 1.05; letter-spacing: 0; }
      .hero p { margin: 12px 0 0; color: var(--muted); font-size: 15px; }
      .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
      .pill { border: 1px solid var(--line); border-radius: 999px; padding: 7px 10px; font-size: 12px; color: var(--ink); background: #fff; }
      nav { display: flex; gap: 8px; overflow-x: auto; padding: 14px 2px 4px; position: sticky; top: 140px; z-index: 1; background: linear-gradient(180deg, rgba(246,250,248,.96), rgba(246,250,248,.82)); }
      nav a { white-space: nowrap; text-decoration: none; color: var(--green); font-size: 13px; font-weight: 800; padding: 8px 10px; border: 1px solid var(--line); border-radius: 999px; background: #fff; }
      section { margin-top: 22px; }
      h2 { margin: 0 0 12px; font-size: 21px; letter-spacing: 0; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .stat-card, .panel, .layer-card, .file-card, .tour-card {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--paper);
        box-shadow: 0 8px 24px rgba(23,33,28,.06);
      }
      .stat-card { padding: 14px; min-height: 104px; }
      .stat-card span, .stat-card small { display: block; color: var(--muted); font-size: 12px; }
      .stat-card strong { display: block; margin: 7px 0; font-size: 28px; color: var(--green); line-height: 1; }
      .panel { padding: 14px; }
      .bar-row { display: grid; grid-template-columns: 92px 1fr 36px; gap: 8px; align-items: center; margin: 10px 0; font-size: 13px; }
      .bar-track { height: 10px; border-radius: 999px; background: #e8eee9; overflow: hidden; }
      .bar-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--green), var(--blue)); }
      .layer-card, .file-card, .tour-card { padding: 14px; margin-bottom: 10px; }
      .layer-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
      .layer-head strong { font-size: 16px; }
      .layer-head span { font-size: 12px; color: var(--muted); white-space: nowrap; }
      .layer-card p, .file-card p, .tour-card p { margin: 8px 0 0; color: var(--muted); font-size: 14px; }
      .layer-track { margin-top: 12px; }
      .file-card code { display: inline-block; max-width: 100%; overflow-wrap: anywhere; color: var(--blue); font-size: 12px; }
      .file-card h3, .tour-card h3 { margin: 8px 0 0; font-size: 16px; }
      .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
      .tags span { font-size: 11px; border-radius: 999px; padding: 4px 7px; background: var(--wash); color: var(--green); }
      .tour-card { display: grid; grid-template-columns: 42px 1fr; gap: 10px; }
      .step { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; color: #fff; background: var(--green); font-weight: 800; }
      .flow { display: grid; gap: 8px; }
      .flow div { padding: 12px 14px; border-radius: 12px; background: #fff; border: 1px solid var(--line); font-weight: 800; }
      .flow span { color: var(--muted); font-weight: 500; display: block; font-size: 12px; margin-top: 2px; }
      footer { margin-top: 28px; color: var(--muted); font-size: 12px; text-align: center; }
      @media (max-width: 430px) {
        .shell { padding-left: 10px; padding-right: 10px; }
        .grid { grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat-card { min-height: 96px; padding: 12px; }
        .stat-card strong { font-size: 24px; }
        nav { top: 132px; }
        .bar-row { grid-template-columns: 82px 1fr 30px; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <header class="hero">
        <p class="eyebrow">手机可读版知识图谱 Dashboard</p>
        <h1>${escapeHtml(graph.project.name)}</h1>
        <p>${escapeHtml(graph.project.description)}</p>
        <div class="pill-row">
          ${graph.project.frameworks.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
        </div>
      </header>

      <nav>
        <a href="#stats">总览</a>
        <a href="#layers">架构层</a>
        <a href="#flow">主流程</a>
        <a href="#files">关键文件</a>
        <a href="#tour">导览</a>
      </nav>

      <section id="stats">
        <h2>总览</h2>
        <div class="grid">
          ${statCard("分析文件", fileNodes.length, "进入知识图谱的文件")}
          ${statCard("图谱节点", graph.nodes.length, "文件、配置、文档、函数")}
          ${statCard("关系连线", graph.edges.length, "导入、调用、转换等")}
          ${statCard("架构层", graph.layers.length, "按职责分组")}
        </div>
      </section>

      <section>
        <h2>节点与关系分布</h2>
        <div class="panel">${barRows(nodeTypeCounts)}</div>
        <div class="panel" style="margin-top:10px">${barRows(edgeTypeCounts)}</div>
      </section>

      <section id="layers">
        <h2>架构层</h2>
        ${layerRows()}
      </section>

      <section id="flow">
        <h2>主流程</h2>
        <div class="flow">
          <div>main.tsx <span>启动 React 应用并加载全局配置</span></div>
          <div>App.tsx <span>组合 A4 预览、右侧工具栏、侧边栏</span></div>
          <div>Zustand Store <span>集中保存模板、正文、AI 配置和工坊状态</span></div>
          <div>Services <span>处理 AI、本地保存、模板识别、导出</span></div>
          <div>Proposal Preview <span>把当前文档渲染为 A4 公文页面</span></div>
        </div>
      </section>

      <section id="files">
        <h2>关键文件</h2>
        ${fileCards()}
      </section>

      <section id="tour">
        <h2>阅读导览</h2>
        ${tourCards()}
      </section>

      <footer>
        生成时间：${escapeHtml(new Date().toLocaleString("zh-CN"))}<br />
        来源：.understand-anything/knowledge-graph.json
      </footer>
    </main>
  </body>
</html>
`;

const md = `# ${graph.project.name} 手机版 Dashboard

> ${graph.project.description}

## 总览

${mdTable([
  ["指标", "数量", "说明"],
  ["分析文件", fileNodes.length, "进入知识图谱的文件"],
  ["图谱节点", graph.nodes.length, "文件、配置、文档、函数"],
  ["关系连线", graph.edges.length, "导入、调用、转换等"],
  ["架构层", graph.layers.length, "按职责分组"],
  ["导览步骤", graph.tour.length, "推荐阅读路径"],
])}

## 技术栈

${graph.project.frameworks.map((item) => `- ${item}`).join("\n")}

## 架构层

${graph.layers.map((layer) => `### ${layer.name}\n\n${layer.description}\n\n文件数：${layer.nodeIds.length}`).join("\n\n")}

## 主流程

1. main.tsx 启动 React 应用并加载全局样式与国际化。
2. App.tsx 组合 A4 预览、右侧工具栏和侧边栏。
3. Zustand Store 集中管理模板、正文、AI 配置和本地持久化。
4. Services 处理 AI 起草、局部改写、模板识别、格式检查和导出。
5. Proposal Preview 将当前文档渲染为 A4 公文页面。

## 关键文件

${keyFiles.map((node) => `### ${node.filePath}\n\n${node.summary}`).join("\n\n")}

## 阅读导览

${graph.tour.map((step) => `${step.order}. ${step.title}\n\n   ${step.description}`).join("\n\n")}

## 关系统计

${mdTable([
  ["关系类型", "数量"],
  ...Object.entries(edgeTypeCounts).sort((a, b) => b[1] - a[1]),
])}
`;

await mkdir(dirname(htmlPath), { recursive: true });
await writeFile(htmlPath, html);
await writeFile(mdPath, md);

console.log(`Wrote ${htmlPath}`);
console.log(`Wrote ${mdPath}`);
