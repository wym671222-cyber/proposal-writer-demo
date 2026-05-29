import type { ProposalDocument, Section } from "@/types/proposal";
import { contentToText } from "@/utils/content";

const chineseNumber = "一二三四五六七八九十百千万";

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanHeadingTitle(line: string) {
  return line
    .replace(/^#{1,3}\s*/, "")
    .replace(/^第?[一二三四五六七八九十百千万\d]+[章节部分、.．)]\s*/, "")
    .replace(/^（[一二三四五六七八九十百千万\d]+）\s*/, "")
    .trim();
}

function looksLikeDocumentTitle(title: string) {
  return /^关于.+(议案|请示)$/.test(title) || (/(议案|请示)$/.test(title) && title.length <= 80);
}

export function parseTopLevelHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^#{1,3}\s+\S+/.test(trimmed)) {
    return cleanHeadingTitle(trimmed);
  }
  if (new RegExp(`^[${chineseNumber}]+[、.．]\\s*\\S+`).test(trimmed)) {
    return cleanHeadingTitle(trimmed);
  }
  if (/^第[一二三四五六七八九十百千万\d]+[章节部分]\s*\S+/.test(trimmed)) {
    return cleanHeadingTitle(trimmed);
  }
  return null;
}

export function splitTextByTopLevelHeadings(text: string) {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const introLines: string[] = [];
  const sections: Section[] = [];
  let current: { title: string; contentLines: string[] } | null = null;

  for (const line of lines) {
    const headingTitle = parseTopLevelHeading(line);
    const isFirstHeading = !current && sections.length === 0 && introLines.length === 0;
    if (headingTitle && !(isFirstHeading && looksLikeDocumentTitle(headingTitle))) {
      if (current) {
        sections.push({
          id: createId("split-section"),
          title: current.title,
          prompt: `请补充${current.title}相关事实、依据、过程和建议。`,
          content: current.contentLines.join("\n").trim() || `请补充${current.title}。`,
        });
      }
      current = { title: headingTitle || "未命名板块", contentLines: [] };
      continue;
    }

    if (current) {
      current.contentLines.push(line);
      continue;
    }
    if (!looksLikeDocumentTitle(cleanHeadingTitle(line))) introLines.push(cleanHeadingTitle(line));
  }

  if (current) {
    sections.push({
      id: createId("split-section"),
      title: current.title,
      prompt: `请补充${current.title}相关事实、依据、过程和建议。`,
      content: current.contentLines.join("\n").trim() || `请补充${current.title}。`,
    });
  }

  return {
    intro: introLines.join("\n").trim(),
    sections,
    found: sections.length > 0,
  };
}

export function documentBodyTextForSplit(document: ProposalDocument) {
  return [
    document.intro,
    ...document.sections.map((section) => contentToText(section.content)),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function normalizeDocumentByHeadings(document: ProposalDocument) {
  const result = splitTextByTopLevelHeadings(documentBodyTextForSplit(document));
  if (!result.found) {
    return { document, changed: false, sectionCount: 0 };
  }

  return {
    document: {
      ...document,
      intro: result.intro || document.intro,
      sections: result.sections,
    },
    changed: true,
    sectionCount: result.sections.length,
  };
}
