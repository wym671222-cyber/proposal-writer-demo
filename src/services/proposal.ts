import type { AIConfig, CheckItem, ProposalDocument, ProposalTemplate } from "@/types/proposal";
import { sectionNumber } from "@/components/Proposal/templates";
import { createConfigFromProvider } from "@/config/ai-providers";
import { contentToMarkdown, contentToText } from "@/utils/content";

export const STORAGE_KEYS = {
  doc: "proposal-demo-document",
  ai: "proposal-demo-ai-config",
  customTemplates: "proposal-demo-custom-templates",
  templateOverrides: "proposal-demo-template-overrides",
};

export const emptyAIConfig: AIConfig = createConfigFromProvider("deepseek");

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function hasLiveAI(config: AIConfig) {
  return Boolean(config.baseUrl.trim() && config.apiKey.trim() && config.model.trim());
}

export function findTemplate(templates: ProposalTemplate[], id: string) {
  return templates.find((template) => template.id === id) ?? templates[0];
}

export function buildChecks(doc: ProposalDocument): CheckItem[] {
  const nonEmptySections = doc.sections.filter((section) => section.content.trim()).length;
  return [
    {
      label: "标题已填写且末尾无标点",
      ok: Boolean(doc.title.trim()) && !/[，。；、,.!?！？;：:]$/.test(doc.title.trim()),
    },
    { label: "主送对象已填写", ok: Boolean(doc.recipient.trim()) },
    { label: "正文引言已填写", ok: Boolean(doc.intro.trim()) },
    { label: "全部固定板块均有内容", ok: nonEmptySections === doc.sections.length },
    {
      label: "包含明确提请审议事项",
      ok: doc.sections.some((section) => {
        return section.title.includes("提请审议") && contentToText(section.content).length > 12;
      }),
    },
    { label: "落款和日期已填写", ok: Boolean(doc.signer.trim() && doc.date.trim()) },
    { label: "行距位于26-28磅", ok: doc.lineHeight >= 26 && doc.lineHeight <= 28 },
  ];
}

export function toMarkdown(doc: ProposalDocument) {
  const sectionMarkdown = doc.sections
    .map((section, index) => `## ${sectionNumber(index)}、${section.title}\n\n${contentToMarkdown(section.content)}`)
    .join("\n\n");
  return `# ${doc.title}

${doc.recipient}：

${doc.intro}

${sectionMarkdown}

${doc.closing}

附件：${doc.attachments || "无"}

${doc.signer}

${doc.date}
`;
}

export function downloadMarkdown(doc: ProposalDocument) {
  const blob = new Blob([toMarkdown(doc)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${doc.title.replace(/[\\/:*?"<>|]/g, "") || "议案草稿"}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
