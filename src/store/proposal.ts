import { create } from "zustand";
import { builtinTemplates, createDocumentFromTemplate, createTemplateFromWorkshop } from "@/components/Proposal/templates";
import { normalizeAIConfig } from "@/config/ai-providers";
import { generateDraft } from "@/services/ai";
import {
  emptyAIConfig,
  findTemplate,
  loadJSON,
  saveJSON,
  STORAGE_KEYS,
} from "@/services/proposal";
import { recognizeTemplateFromFile } from "@/services/templateRecognition";
import { normalizeDocumentByHeadings } from "@/utils/documentSplit";
import type {
  AIConfig,
  DrawerId,
  ProposalDocument,
  ProposalTemplate,
  Section,
  TemplateDraftOrigin,
  TemplateOverrides,
  WorkshopForm,
} from "@/types/proposal";

type ProposalState = {
  customTemplates: ProposalTemplate[];
  templateOverrides: TemplateOverrides;
  templates: ProposalTemplate[];
  activeTemplateId: string;
  document: ProposalDocument;
  plainText: string;
  aiConfig: AIConfig;
  workshop: WorkshopForm;
  templateDraft: ProposalTemplate | null;
  templateDraftOrigin: TemplateDraftOrigin | null;
  templateMessage: string;
  recognitionMessage: string;
  sectionSplitMessage: string;
  isRecognizingTemplate: boolean;
  drawer: DrawerId | null;
  generationState: string;
  exportMessage: string;
  isGenerating: boolean;
  setDrawer: (drawer: DrawerId | null) => void;
  selectTemplate: (templateId: string) => void;
  resetTemplate: () => void;
  updateDocument: (patch: Partial<ProposalDocument>) => void;
  updateSection: (sectionId: string, patch: { title?: string; content?: string }) => void;
  reorderSections: (activeId: string, overId: string) => void;
  splitCurrentDocumentByHeadings: () => void;
  setPlainText: (plainText: string) => void;
  setAIConfig: (config: AIConfig) => void;
  setWorkshop: (patch: Partial<WorkshopForm>) => void;
  createCustomTemplate: () => void;
  startTemplateEdit: (templateId: string) => void;
  cancelTemplateEdit: () => void;
  updateTemplateDraft: (patch: Partial<ProposalTemplate>) => void;
  updateTemplateDraftSection: (sectionId: string, patch: Partial<Section>) => void;
  addTemplateDraftSection: () => void;
  removeTemplateDraftSection: (sectionId: string) => void;
  reorderTemplateDraftSections: (activeId: string, overId: string) => void;
  saveTemplateDraft: () => void;
  restoreBuiltinTemplate: (templateId: string) => void;
  recognizeWorkshopTemplate: (file: File) => Promise<void>;
  clearWorkshopRecognition: () => void;
  generateFromPlainText: () => Promise<void>;
  setExportMessage: (message: string) => void;
};

const storedCustomTemplates = loadJSON<ProposalTemplate[]>(STORAGE_KEYS.customTemplates, []);
const storedTemplateOverrides = loadJSON<TemplateOverrides>(STORAGE_KEYS.templateOverrides, {});

function cloneTemplate(template: ProposalTemplate): ProposalTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({ ...section })),
  };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeTemplates(customTemplates: ProposalTemplate[], templateOverrides: TemplateOverrides) {
  const overriddenBuiltinTemplates = builtinTemplates.map((template) => {
    const override = templateOverrides[template.id];
    if (!override) return cloneTemplate(template);
    return {
      ...template,
      ...override,
      id: template.id,
      category: "builtin" as const,
      sections: override.sections?.length ? override.sections.map((section) => ({ ...section })) : template.sections,
    };
  });
  return [
    ...overriddenBuiltinTemplates,
    ...customTemplates.map((template) => ({
      ...cloneTemplate(template),
      category: "custom" as const,
    })),
  ];
}

const templates = mergeTemplates(storedCustomTemplates, storedTemplateOverrides);
const firstTemplate = templates[0];
const storedDocument = loadJSON<ProposalDocument>(
  STORAGE_KEYS.doc,
  createDocumentFromTemplate(firstTemplate),
);
const activeTemplateId = templates.some((template) => template.id === storedDocument.templateId)
  ? storedDocument.templateId
  : firstTemplate.id;

function persistDocument(document: ProposalDocument) {
  saveJSON(STORAGE_KEYS.doc, document);
}

function persistCustomTemplates(customTemplates: ProposalTemplate[]) {
  saveJSON(STORAGE_KEYS.customTemplates, customTemplates);
}

function persistTemplateOverrides(templateOverrides: TemplateOverrides) {
  saveJSON(STORAGE_KEYS.templateOverrides, templateOverrides);
}

function persistAIConfig(aiConfig: AIConfig) {
  saveJSON(STORAGE_KEYS.ai, aiConfig);
}

function syncTemplates(
  customTemplates: ProposalTemplate[],
  templateOverrides: TemplateOverrides,
) {
  return mergeTemplates(customTemplates, templateOverrides);
}

function createNormalizedDocumentFromTemplate(template: ProposalTemplate) {
  return normalizeDocumentByHeadings(createDocumentFromTemplate(template)).document;
}

function sanitizeSections(sections: Section[]) {
  const usedIds = new Set<string>();
  const nextSections = sections
    .map((section) => {
      const title = section.title.trim();
      if (!title) return null;
      let id = section.id || createId("section");
      if (usedIds.has(id)) id = createId("section");
      usedIds.add(id);
      return {
        id,
        title,
        prompt: section.prompt.trim() || `请补充${title}相关事实、依据和建议。`,
        content: section.content.trim() || `请补充${title}。`,
      };
    })
    .filter(Boolean) as Section[];

  if (nextSections.length) return nextSections;
  return ["基本情况", "事项必要性", "主要内容", "提请审议事项"].map((title) => ({
    id: createId("section"),
    title,
    prompt: `请补充${title}相关事实、依据和建议。`,
    content: `请补充${title}。`,
  }));
}

function sanitizeTemplate(template: ProposalTemplate): ProposalTemplate {
  const documentType = template.documentType === "请示" ? "请示" : "议案";
  const name = template.name.trim() || "自定义议案模板";
  return {
    ...template,
    name,
    shortName: template.shortName.trim() || name.slice(0, 12),
    documentType,
    meeting: template.meeting.trim() || "内部会议审议",
    recipient: template.recipient.trim() || "公司领导",
    description: template.description.trim() || "本地保存的议案/请示模板。",
    titlePattern: template.titlePattern.trim() || `关于${name}的${documentType}`,
    introHint: template.introHint.trim() || "根据工作安排，现就相关事项提请审议，具体情况如下：",
    sections: sanitizeSections(template.sections),
    decisionSentence: template.decisionSentence.trim() || "请予审议。",
    signer: template.signer.trim() || "深圳市安居建业投资运营有限公司",
    attachments: template.attachments.trim() || "1. 相关佐证材料",
  };
}

function setWorkshopFromTemplate(template: ProposalTemplate): WorkshopForm {
  return {
    name: template.name,
    scenario: template.meeting,
    matter: template.description,
    sections: template.sections.map((section) => section.title).join("\n"),
  };
}

export const useProposalStore = create<ProposalState>((set, get) => ({
  customTemplates: storedCustomTemplates,
  templateOverrides: storedTemplateOverrides,
  templates,
  activeTemplateId,
  document: storedDocument,
  plainText:
    "例如：公司计划外新增一项信息化服务采购，预算约30万元，主要用于提升运营管理效率，希望走公司采购流程并提交领导审议。",
  aiConfig: normalizeAIConfig(loadJSON<AIConfig>(STORAGE_KEYS.ai, emptyAIConfig)),
  workshop: { name: "", scenario: "", matter: "", sections: "" },
  templateDraft: null,
  templateDraftOrigin: null,
  templateMessage: "",
  recognitionMessage: "",
  sectionSplitMessage: "",
  isRecognizingTemplate: false,
  drawer: null,
  generationState: "未配置 BYOK 时将使用模拟生成，方便完整体验流程。",
  exportMessage: "",
  isGenerating: false,

  setDrawer: (drawer) =>
    set(
      drawer === null
        ? {
            drawer,
            templateDraft: null,
            templateDraftOrigin: null,
            templateMessage: "",
            recognitionMessage: "",
          }
        : { drawer },
    ),

  selectTemplate: (templateId) => {
    const template = findTemplate(get().templates, templateId);
    const document = createNormalizedDocumentFromTemplate(template);
    persistDocument(document);
    set({
      activeTemplateId: template.id,
      document,
      drawer: null,
      generationState: `已切换为「${template.name}」。`,
    });
  },

  resetTemplate: () => {
    const template = findTemplate(get().templates, get().activeTemplateId);
    const document = createNormalizedDocumentFromTemplate(template);
    persistDocument(document);
    set({ document, generationState: "已恢复当前模板默认内容。" });
  },

  updateDocument: (patch) => {
    const document = { ...get().document, ...patch };
    persistDocument(document);
    set({ document });
  },

  updateSection: (sectionId, patch) => {
    const document = {
      ...get().document,
      sections: get().document.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    };
    persistDocument(document);
    set({ document });
  },

  reorderSections: (activeId, overId) => {
    const sections = get().document.sections;
    const activeIndex = sections.findIndex((section) => section.id === activeId);
    const overIndex = sections.findIndex((section) => section.id === overId);
    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return;
    const nextSections = [...sections];
    const [moved] = nextSections.splice(activeIndex, 1);
    nextSections.splice(overIndex, 0, moved);
    const document = { ...get().document, sections: nextSections };
    persistDocument(document);
    set({ document });
  },

  splitCurrentDocumentByHeadings: () => {
    const result = normalizeDocumentByHeadings(get().document);
    if (!result.changed) {
      set({ sectionSplitMessage: "未识别到“一、二、三”等一级标题，当前板块保持不变。" });
      return;
    }
    persistDocument(result.document);
    set({
      document: result.document,
      sectionSplitMessage: `已按一级标题重新拆分为 ${result.sectionCount} 个板块。`,
    });
  },

  setPlainText: (plainText) => set({ plainText }),

  setAIConfig: (aiConfig) => {
    persistAIConfig(aiConfig);
    set({ aiConfig });
  },

  setWorkshop: (patch) =>
    set((state) => ({
      workshop: { ...state.workshop, ...patch },
    })),

  createCustomTemplate: () => {
    const draft = get().templateDraftOrigin === "workshop" ? get().templateDraft : null;
    const template = sanitizeTemplate(
      draft
        ? { ...draft, id: createId("custom"), category: "custom" }
        : createTemplateFromWorkshop(get().workshop),
    );
    const customTemplates = [...get().customTemplates, template];
    const templates = syncTemplates(customTemplates, get().templateOverrides);
    const document = createNormalizedDocumentFromTemplate(template);
    persistCustomTemplates(customTemplates);
    persistDocument(document);
    set({
      customTemplates,
      templates,
      activeTemplateId: template.id,
      document,
      workshop: { name: "", scenario: "", matter: "", sections: "" },
      templateDraft: null,
      templateDraftOrigin: null,
      recognitionMessage: "",
      drawer: null,
      generationState: `已创建自定义模板「${template.name}」。`,
    });
  },

  startTemplateEdit: (templateId) => {
    const template = findTemplate(get().templates, templateId);
    set({
      templateDraft: cloneTemplate(template),
      templateDraftOrigin: "library",
      templateMessage: "",
    });
  },

  cancelTemplateEdit: () =>
    set({
      templateDraft: null,
      templateDraftOrigin: null,
      templateMessage: "",
    }),

  updateTemplateDraft: (patch) =>
    set((state) => ({
      templateDraft: state.templateDraft ? { ...state.templateDraft, ...patch } : state.templateDraft,
    })),

  updateTemplateDraftSection: (sectionId, patch) =>
    set((state) => ({
      templateDraft: state.templateDraft
        ? {
            ...state.templateDraft,
            sections: state.templateDraft.sections.map((section) =>
              section.id === sectionId ? { ...section, ...patch } : section,
            ),
          }
        : state.templateDraft,
    })),

  addTemplateDraftSection: () =>
    set((state) => {
      if (!state.templateDraft) return state;
      const section: Section = {
        id: createId("section"),
        title: "新增板块",
        prompt: "请补充新增板块相关事实、依据和建议。",
        content: "请补充新增板块。",
      };
      return {
        templateDraft: {
          ...state.templateDraft,
          sections: [...state.templateDraft.sections, section],
        },
      };
    }),

  removeTemplateDraftSection: (sectionId) =>
    set((state) => {
      if (!state.templateDraft || state.templateDraft.sections.length <= 1) return state;
      return {
        templateDraft: {
          ...state.templateDraft,
          sections: state.templateDraft.sections.filter((section) => section.id !== sectionId),
        },
      };
    }),

  reorderTemplateDraftSections: (activeId, overId) =>
    set((state) => {
      const sections = state.templateDraft?.sections;
      if (!state.templateDraft || !sections) return state;
      const activeIndex = sections.findIndex((section) => section.id === activeId);
      const overIndex = sections.findIndex((section) => section.id === overId);
      if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) return state;
      const nextSections = [...sections];
      const [moved] = nextSections.splice(activeIndex, 1);
      nextSections.splice(overIndex, 0, moved);
      return {
        templateDraft: {
          ...state.templateDraft,
          sections: nextSections,
        },
      };
    }),

  saveTemplateDraft: () => {
    const draft = get().templateDraft;
    if (!draft) return;
    const template = sanitizeTemplate(draft);
    if (template.category === "builtin") {
      const templateOverrides = {
        ...get().templateOverrides,
        [template.id]: template,
      };
      const templates = syncTemplates(get().customTemplates, templateOverrides);
      persistTemplateOverrides(templateOverrides);
      set({
        templateOverrides,
        templates,
        templateDraft: cloneTemplate(findTemplate(templates, template.id)),
        templateMessage: `已保存「${template.name}」的本地调整。`,
      });
      return;
    }

    const exists = get().customTemplates.some((item) => item.id === template.id);
    const customTemplates = exists
      ? get().customTemplates.map((item) => (item.id === template.id ? template : item))
      : [...get().customTemplates, { ...template, id: createId("custom"), category: "custom" as const }];
    const templates = syncTemplates(customTemplates, get().templateOverrides);
    persistCustomTemplates(customTemplates);
    set({
      customTemplates,
      templates,
      templateDraft: cloneTemplate(findTemplate(templates, template.id)),
      templateMessage: `已保存自定义模板「${template.name}」。`,
    });
  },

  restoreBuiltinTemplate: (templateId) => {
    const { [templateId]: _removed, ...templateOverrides } = get().templateOverrides;
    const templates = syncTemplates(get().customTemplates, templateOverrides);
    persistTemplateOverrides(templateOverrides);
    set({
      templateOverrides,
      templates,
      templateDraft: cloneTemplate(findTemplate(templates, templateId)),
      templateDraftOrigin: "library",
      templateMessage: "已恢复系统默认模板。",
    });
  },

  recognizeWorkshopTemplate: async (file) => {
    set({
      isRecognizingTemplate: true,
      recognitionMessage: `正在识别「${file.name}」...`,
    });
    try {
      const result = await recognizeTemplateFromFile(file, get().aiConfig);
      set({
        isRecognizingTemplate: false,
        recognitionMessage: result.message,
        templateDraft: result.template,
        templateDraftOrigin: "workshop",
        workshop: setWorkshopFromTemplate(result.template),
      });
    } catch (error) {
      set({
        isRecognizingTemplate: false,
        recognitionMessage: error instanceof Error ? error.message : "模板识别失败。",
      });
    }
  },

  clearWorkshopRecognition: () =>
    set({
      templateDraft: null,
      templateDraftOrigin: null,
      recognitionMessage: "",
    }),

  generateFromPlainText: async () => {
    const template = findTemplate(get().templates, get().activeTemplateId);
    set({ isGenerating: true, generationState: "正在生成结构化草稿..." });
    const result = await generateDraft(get().aiConfig, template, get().document, get().plainText);
    const normalized = normalizeDocumentByHeadings(result.document).document;
    persistDocument(normalized);
    set({
      document: normalized,
      generationState: result.message,
      isGenerating: false,
      drawer: "editor",
    });
  },

  setExportMessage: (exportMessage) => set({ exportMessage }),
}));
