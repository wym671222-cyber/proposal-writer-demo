import { formatStandard } from "@/components/Proposal/templates";
import type { AIConfig, ProposalDocument, ProposalTemplate } from "@/types/proposal";
import { contentToText } from "@/utils/content";
import { normalizeDocumentByHeadings } from "@/utils/documentSplit";
import { hasLiveAI } from "./proposal";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function chatCompletionsUrl(baseUrl: string) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (/\/chat\/completions$/i.test(normalized)) return normalized;
  if (/^https:\/\/api\.deepseek\.com$/i.test(normalized)) return `${normalized}/chat/completions`;
  if (/\/v1$/i.test(normalized)) return `${normalized}/chat/completions`;
  return `${normalized}/v1/chat/completions`;
}

function cleanPlainText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function extractJSON(text: string) {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/)?.[1];
  const loose = fenced ?? text.match(/```\s*([\s\S]*?)\s*```/)?.[1] ?? text;
  const first = loose.indexOf("{");
  const last = loose.lastIndexOf("}");
  const jsonText = first >= 0 && last > first ? loose.slice(first, last + 1) : loose;
  return JSON.parse(jsonText);
}

export function buildMockDocument(
  template: ProposalTemplate,
  current: ProposalDocument,
  plainText: string,
): ProposalDocument {
  const matter = cleanPlainText(plainText) || "请补充事项背景、目标、金额、程序和审议诉求。";
  const titleSeed = matter.length > 28 ? `${matter.slice(0, 28)}...` : matter;

  if (template.id === "purchase-initiation") {
    return {
      ...current,
      title: "关于公司年度计划外项目采购立项的请示",
      intro: `鉴于${titleSeed}，相关项目需要开展采购工作。由于本次采购属于公司年度计划外事项，现提出采购立项申请，详细内容汇报如下：`,
      sections: current.sections.map((section) => {
        const contentById: Record<string, string> = {
          background: `根据用户描述，当前事项主要涉及：${matter}。该事项已进入前期论证阶段，需要尽快明确采购立项安排，以保障后续工作有序推进。`,
          purpose:
            "本次采购立项目的是补齐项目实施所需的工程、货物或服务条件，支撑相关业务目标按计划推进，并为后续采购程序提供立项依据。",
          necessity:
            "该事项属于年度计划外新增需求，如不及时启动采购立项，可能影响项目实施进度、服务保障水平或管理要求落实。开展采购立项具有必要性和紧迫性。",
          scope:
            "（一）项目名称：年度计划外采购项目\n（二）采购内容：根据事项需求采购相关工程、货物或服务\n（三）预估金额：待进一步测算\n（四）采购方式：按公司采购管理制度执行",
          decision:
            "同意年度计划外采购项目立项，并按公司采购管理制度和本请示内容推进后续采购工作。",
        };
        return { ...section, content: contentById[section.id] ?? section.content };
      }),
    };
  }

  if (template.id === "subsidiary-meeting") {
    return {
      ...current,
      title: "关于审议参控股公司相关事项的议案",
      intro: `近日，公司收到参控股公司报送的相关议题材料，事项主要涉及：${titleSeed}。前期相关职能中心已开展研究论证，现将该议题上报${current.meeting || template.meeting}审议，有关情况汇报如下：`,
      sections: current.sections.map((section) => {
        const contentById: Record<string, string> = {
          core: `本议案事项核心内容为：${matter}。相关安排需平台公司内部会议审议后，指导派出董事或相关管理人员依法依规履行职责。`,
          necessity:
            "该事项关系参控股公司经营管理、公司治理或重大事项决策，需平台公司在内部履行研究和审议程序后形成明确意见，具有审议必要性。",
          "department-opinion":
            "经牵头部门初步研究，原则同意参控股公司按报送方案推进相关事项。建议进一步完善依据材料、风险说明和后续执行安排，并按公司治理要求做好会议材料归档。",
          procedure:
            "参控股公司已按内部治理程序对相关事项进行研究审议。平台公司相关职能中心已开展前置研究，后续将根据本次会议审议意见履行相应决策和授权程序。",
          decision:
            "同意参控股公司提请审议的相关议案，同意授权公司相关派出董事按平台公司审议意见进行表决并签署相关决议文件。",
        };
        return { ...section, content: contentById[section.id] ?? section.content };
      }),
    };
  }

  return {
    ...current,
    title: `关于${template.shortName || "相关事项"}的${template.documentType}`,
    intro: `根据工作安排，现就${matter}有关事项提请审议，具体情况如下：`,
    sections: current.sections.map((section) => ({
      ...section,
      content: `${section.prompt}\n\n依据用户描述，本部分可围绕“${matter}”展开，补充事实依据、执行安排和审议诉求。`,
    })),
  };
}

function coerceGeneratedDocument(
  template: ProposalTemplate,
  current: ProposalDocument,
  value: unknown,
) {
  const parsed = value as Partial<ProposalDocument>;
  const byTitle = new Map<string, string>();
  if (Array.isArray(parsed.sections)) {
    parsed.sections.forEach((section) => {
      if (section && typeof section.title === "string" && typeof section.content === "string") {
        byTitle.set(section.title, section.content);
      }
    });
  }

  const document = {
    ...current,
    title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : current.title,
    recipient:
      typeof parsed.recipient === "string" && parsed.recipient.trim()
        ? parsed.recipient
        : current.recipient,
    intro: typeof parsed.intro === "string" && parsed.intro.trim() ? parsed.intro : current.intro,
    closing:
      typeof parsed.closing === "string" && parsed.closing.trim() ? parsed.closing : current.closing,
    attachments: typeof parsed.attachments === "string" ? parsed.attachments : current.attachments,
    signer: typeof parsed.signer === "string" && parsed.signer.trim() ? parsed.signer : current.signer,
    sections: current.sections.map((section, index) => ({
      ...section,
      content:
        byTitle.get(section.title) ??
        (Array.isArray(parsed.sections) && typeof parsed.sections[index]?.content === "string"
          ? parsed.sections[index]!.content
          : section.content),
    })),
    templateId: template.id,
  };

  return normalizeDocumentByHeadings(document).document;
}

async function generateWithAI(
  config: AIConfig,
  template: ProposalTemplate,
  current: ProposalDocument,
  plainText: string,
  signal?: AbortSignal,
) {
  const systemPrompt =
    "你是深圳市安居建业投资运营有限公司的企业内部议案/请示起草助手。必须基于用户事实写作，不编造金额、日期、会议结论或已履行程序。只输出合法 JSON，不要 Markdown。";
  const userPrompt = {
    task: "把用户的大白话改写为结构化议案/请示草稿",
    formatRules: formatStandard,
    template: {
      name: template.name,
      documentType: template.documentType,
      meeting: template.meeting,
      sections: template.sections.map(({ title, prompt }) => ({ title, prompt })),
    },
    currentDocument: current,
    userPlainText: plainText,
    outputSchema: {
      title: "string",
      recipient: "string",
      intro: "string",
      sections: [{ title: "string", content: "string" }],
      closing: "string",
      attachments: "string",
      signer: "string",
    },
  };

  const response = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt, null, 2) },
      ],
    }),
    signal,
  });

  if (!response.ok) throw new Error(`AI 请求失败：${response.status}`);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 返回内容为空");
  return coerceGeneratedDocument(template, current, extractJSON(content));
}

export async function generateDraft(
  config: AIConfig,
  template: ProposalTemplate,
  current: ProposalDocument,
  plainText: string,
) {
  if (!hasLiveAI(config)) {
    return {
      document: buildMockDocument(template, current, plainText),
      message: "已使用模拟 AI 生成草稿。",
    };
  }

  try {
    return {
      document: await generateWithAI(config, template, current, plainText),
      message: "已使用 BYOK 生成草稿。",
    };
  } catch (error) {
    return {
      document: buildMockDocument(template, current, plainText),
      message: `${error instanceof Error ? error.message : "AI 生成失败"}。已自动回退到模拟草稿。`,
    };
  }
}

export async function rewriteSelectedText(
  config: AIConfig,
  input: {
    sectionTitle: string;
    selectedText: string;
    instruction: string;
    context: string;
  },
) {
  if (!hasLiveAI(config)) throw new Error("请先在“密钥”中配置 API Key 后再使用局部 AI 修改。");

  const response = await fetch(chatCompletionsUrl(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是企业内部议案/请示文稿润色助手。只改写用户选中的文字，不扩展事实，不编造金额、日期、流程或结论。只输出改写后的文字，不要解释。",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              sectionTitle: input.sectionTitle,
              selectedText: input.selectedText,
              userInstruction: input.instruction,
              sectionContext: contentToText(input.context).slice(0, 3000),
            },
            null,
            2,
          ),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`AI 修改失败：${response.status}`);
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI 修改返回为空。");
  return content.replace(/^```(?:text|markdown)?\s*/i, "").replace(/\s*```$/, "").trim();
}
