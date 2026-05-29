import * as mammoth from "mammoth";
import { chatCompletionsUrl } from "@/services/ai";
import { hasLiveAI } from "@/services/proposal";
import type { AIConfig, ProposalTemplate, RecognizedTemplateResult, Section } from "@/types/proposal";
import { parseTopLevelHeading, splitTextByTopLevelHeadings } from "@/utils/documentSplit";

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isSectionHeading(line: string) {
  return Boolean(parseTopLevelHeading(line));
}

function isDateLine(line: string) {
  return /^\d{4}年\d{1,2}月\d{1,2}日$/.test(line.trim());
}

function inferDocumentType(text: string, title: string): "请示" | "议案" {
  if (title.includes("请示")) return "请示";
  if (title.includes("议案")) return "议案";
  return text.includes("请示") && !text.includes("议案") ? "请示" : "议案";
}

function inferMeeting(text: string) {
  if (text.includes("党支委会") && text.includes("总办会")) return "党支委会、总办会";
  if (text.includes("党委会") && text.includes("总办会")) return "党委会、总办会";
  if (text.includes("总办会")) return "总办会";
  if (text.includes("党委会")) return "党委会";
  if (text.includes("公司领导")) return "公司领导审议";
  return "内部会议审议";
}

function findTitle(lines: string[], fileName: string) {
  const titleLine =
    lines.find((line) => /关于.+(议案|请示)$/.test(line.trim())) ??
    lines.find((line) => /(议案|请示)$/.test(line.trim()) && line.length <= 80) ??
    lines.find((line) => line.length >= 6 && line.length <= 80);
  return titleLine?.trim() || fileName.replace(/\.[^.]+$/, "") || "自定义议案模板";
}

function findRecipient(lines: string[]) {
  const beforeSections = lines.slice(0, Math.max(lines.findIndex(isSectionHeading), 8));
  const recipient = beforeSections.find((line) => /^[\u4e00-\u9fa5A-Za-z0-9（）()、,，\s]{2,30}[：:]$/.test(line));
  return recipient?.replace(/[：:]$/, "").trim() || "公司领导";
}

function findSignature(lines: string[]) {
  const tail = lines.slice(-8).map((line) => line.trim()).filter(Boolean);
  const dateIndex = tail.findIndex(isDateLine);
  const beforeDate = dateIndex > 0 ? tail.slice(0, dateIndex).reverse() : tail.reverse();
  return (
    beforeDate.find((line) => {
      return !line.startsWith("附件") && /(公司|部门|中心|事业部|委员会)$/.test(line) && line.length <= 40;
    }) || "深圳市安居建业投资运营有限公司"
  );
}

function findAttachments(lines: string[]) {
  const attachmentIndex = lines.findIndex((line) => /^附件[：:]/.test(line.trim()));
  if (attachmentIndex < 0) return "1. 相关佐证材料";
  const attachmentLines: string[] = [];
  for (const line of lines.slice(attachmentIndex)) {
    if (isDateLine(line) || /(公司|部门|中心|事业部)$/.test(line.trim())) break;
    attachmentLines.push(line.replace(/^附件[：:]\s*/, "").trim());
  }
  return attachmentLines.filter(Boolean).join("\n") || "1. 相关佐证材料";
}

function findClosing(lines: string[]) {
  return lines.find((line) => /请予审议|妥否，请批示|以上请示/.test(line))?.trim() || "请予审议。";
}

function createSections(lines: string[]): Section[] {
  const split = splitTextByTopLevelHeadings(lines.join("\n"));
  const sections = split.sections.filter((section) => section.title && !/^附件/.test(section.title));

  if (sections.length) return sections;

  return ["基本情况", "事项必要性", "主要内容", "风险及建议", "提请审议事项"].map((title) => ({
    id: createId("recognized-section"),
    title,
    prompt: `请补充${title}相关事实、依据、过程和建议。`,
    content: `请补充${title}。`,
  }));
}

function createLocalTemplate(text: string, fileName: string): ProposalTemplate {
  const normalized = normalizeText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (normalized.length < 20 || lines.length < 2) {
    throw new Error("未提取到足够的模板文本。");
  }

  const title = findTitle(lines, fileName);
  const documentType = inferDocumentType(normalized, title);
  const recipient = findRecipient(lines);
  const firstSectionIndex = lines.findIndex(isSectionHeading);
  const introLines = firstSectionIndex > 0 ? lines.slice(0, firstSectionIndex) : [];
  const introHint =
    introLines
      .filter((line) => line !== title && !line.startsWith(recipient))
      .join("\n")
      .slice(0, 500) || `根据工作安排，现就相关事项提请审议，具体情况如下：`;
  const conciseName = title.replace(/^关于/, "").replace(new RegExp(`的${documentType}$`), "");

  return {
    id: createId("custom"),
    name: `${conciseName || title}模板`,
    shortName: (conciseName || title).slice(0, 12),
    category: "custom",
    documentType,
    meeting: inferMeeting(normalized),
    recipient,
    description: `由上传文件「${fileName}」识别生成的模板。`,
    titlePattern: title,
    introHint,
    sections: createSections(lines),
    decisionSentence: findClosing(lines),
    signer: findSignature(lines),
    attachments: findAttachments(lines),
  };
}

function extractJSON(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/)?.[1];
  const loose = fenced ?? text.match(/```\s*([\s\S]*?)\s*```/)?.[1] ?? text;
  const first = loose.indexOf("{");
  const last = loose.lastIndexOf("}");
  const jsonText = first >= 0 && last > first ? loose.slice(first, last + 1) : loose;
  return JSON.parse(jsonText);
}

function coerceAIResponse(base: ProposalTemplate, value: unknown): ProposalTemplate {
  const parsed = value as Partial<ProposalTemplate>;
  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .filter((section) => section && typeof section.title === "string")
        .map((section, index) => ({
          id: base.sections[index]?.id ?? createId("recognized-section"),
          title: String(section.title || base.sections[index]?.title || "模板板块").trim(),
          prompt:
            typeof section.prompt === "string" && section.prompt.trim()
              ? section.prompt
              : `请补充${section.title}相关事实、依据和建议。`,
          content:
            typeof section.content === "string" && section.content.trim()
              ? section.content
              : base.sections[index]?.content ?? `请补充${section.title}。`,
        }))
    : base.sections;

  return {
    ...base,
    name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : base.name,
    shortName: typeof parsed.shortName === "string" && parsed.shortName.trim() ? parsed.shortName : base.shortName,
    documentType: parsed.documentType === "请示" ? "请示" : parsed.documentType === "议案" ? "议案" : base.documentType,
    meeting: typeof parsed.meeting === "string" && parsed.meeting.trim() ? parsed.meeting : base.meeting,
    recipient: typeof parsed.recipient === "string" && parsed.recipient.trim() ? parsed.recipient : base.recipient,
    description:
      typeof parsed.description === "string" && parsed.description.trim() ? parsed.description : base.description,
    titlePattern:
      typeof parsed.titlePattern === "string" && parsed.titlePattern.trim() ? parsed.titlePattern : base.titlePattern,
    introHint: typeof parsed.introHint === "string" && parsed.introHint.trim() ? parsed.introHint : base.introHint,
    sections: sections.length ? sections : base.sections,
    decisionSentence:
      typeof parsed.decisionSentence === "string" && parsed.decisionSentence.trim()
        ? parsed.decisionSentence
        : base.decisionSentence,
    signer: typeof parsed.signer === "string" && parsed.signer.trim() ? parsed.signer : base.signer,
    attachments: typeof parsed.attachments === "string" ? parsed.attachments : base.attachments,
  };
}

async function enhanceWithAI(template: ProposalTemplate, rawText: string, config: AIConfig) {
  if (!hasLiveAI(config)) return { template, usedAI: false };

  const response = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是企业内部议案/请示模板识别助手。基于上传文本抽取模板结构，不编造审批结论、金额或日期。只输出合法 JSON。",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "从上传文档中识别议案/请示模板结构，并补全板块提示词",
              localParsedTemplate: template,
              rawText: rawText.slice(0, 12000),
              outputSchema: {
                name: "string",
                shortName: "string",
                documentType: "议案或请示",
                meeting: "string",
                recipient: "string",
                description: "string",
                titlePattern: "string",
                introHint: "string",
                sections: [{ title: "string", prompt: "string", content: "string" }],
                decisionSentence: "string",
                signer: "string",
                attachments: "string",
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI 识别增强失败：${response.status}`);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 识别增强返回为空");
  return { template: coerceAIResponse(template, extractJSON(content)), usedAI: true };
}

async function readDocx(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function readPDF(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({
    data: bytes,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    pageTexts.push(textContent.items.map((item) => item.str ?? "").join(" "));
  }
  const text = pageTexts.join("\n");
  if (!text.trim()) throw new Error("PDF 未提取到可用文本，暂不支持扫描件 OCR。");
  return text;
}

async function readUploadText(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return readDocx(file);
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) return file.text();
  if (name.endsWith(".pdf")) return readPDF(file);
  throw new Error("暂不支持该文件类型，请上传 DOCX、MD 或 PDF。");
}

export async function recognizeTemplateFromFile(
  file: File,
  aiConfig: AIConfig,
): Promise<RecognizedTemplateResult> {
  const rawText = normalizeText(await readUploadText(file));
  const localTemplate = createLocalTemplate(rawText, file.name);

  try {
    const enhanced = await enhanceWithAI(localTemplate, rawText, aiConfig);
    return {
      template: enhanced.template,
      rawText,
      message: enhanced.usedAI
        ? "已完成本地解析，并使用 BYOK 增强模板结构。"
        : "已完成本地解析，未配置 BYOK，未进行 AI 增强。",
    };
  } catch (error) {
    return {
      template: localTemplate,
      rawText,
      message: `${error instanceof Error ? error.message : "AI 增强失败"}，已保留本地识别结果。`,
    };
  }
}
