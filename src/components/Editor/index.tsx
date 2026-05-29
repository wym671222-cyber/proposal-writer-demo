import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  FileArchive,
  FileDown,
  FileText,
  GripVertical,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatStandard, sectionNumber } from "@/components/Proposal/templates";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { RichTextEditor, type RichTextAIRequest } from "./RichTextEditor";
import { useProposalStore } from "@/store/proposal";
import { rewriteSelectedText } from "@/services/ai";
import { downloadMarkdown, findTemplate, hasLiveAI, toMarkdown } from "@/services/proposal";
import { useFormatChecks } from "@/hooks/useFormatChecks";
import { contentToText } from "@/utils/content";
import {
  AI_PROVIDER_PRESETS,
  CUSTOM_PROVIDER_ID,
  createConfigFromModel,
  createConfigFromProvider,
  findModelId,
  getProviderPreset,
} from "@/config/ai-providers";
import type { ProposalTemplate, Section } from "@/types/proposal";
import type { DrawerId } from "@/types/proposal";

const titles: Record<DrawerId, { title: string; subtitle: string }> = {
  templates: { title: "模板库", subtitle: "选择内置模板或自定义模板" },
  draft: { title: "AI 起草", subtitle: "用大白话生成议案草稿" },
  editor: { title: "内容编辑", subtitle: "按板块调整正文" },
  ai: { title: "BYOK 配置", subtitle: "OpenAI-compatible 本地密钥" },
  workshop: { title: "模板工坊", subtitle: "生成 XX 类型议案模板" },
  checks: { title: "格式检查", subtitle: "按公司议案/请示格式标准审查" },
  export: { title: "导出", subtitle: "Markdown 已可用，DOCX/PDF 预留" },
  appearance: { title: "外观控制", subtitle: "控制 A4 预览的基础排版" },
};

export function EditorDrawer() {
  const { t } = useTranslation();
  const drawer = useProposalStore((state) => state.drawer);
  const setDrawer = useProposalStore((state) => state.setDrawer);

  return (
    <AnimatePresence>
      {drawer && (
        <motion.aside
          className="editor-drawer"
          initial={{ opacity: 0, x: 28, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <header className="drawer-header">
            <div>
              <h2>{t(`drawer.${drawer}`, titles[drawer].title)}</h2>
              <p>{titles[drawer].subtitle}</p>
            </div>
            <Button icon={<X size={17} />} aria-label="关闭" title="关闭" onClick={() => setDrawer(null)} />
          </header>
          <div className="drawer-content">
            {drawer === "templates" && <TemplatePanel />}
            {drawer === "draft" && <DraftPanel />}
            {drawer === "editor" && <DocumentEditor />}
            {drawer === "ai" && <AISettingsPanel />}
            {drawer === "workshop" && <WorkshopPanel />}
            {drawer === "checks" && <ChecksPanel />}
            {drawer === "export" && <ExportPanel />}
            {drawer === "appearance" && <AppearancePanel />}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function TemplatePanel() {
  const templates = useProposalStore((state) => state.templates);
  const templateOverrides = useProposalStore((state) => state.templateOverrides);
  const templateDraft = useProposalStore((state) => state.templateDraft);
  const templateDraftOrigin = useProposalStore((state) => state.templateDraftOrigin);
  const templateMessage = useProposalStore((state) => state.templateMessage);
  const activeTemplateId = useProposalStore((state) => state.activeTemplateId);
  const selectTemplate = useProposalStore((state) => state.selectTemplate);
  const startTemplateEdit = useProposalStore((state) => state.startTemplateEdit);
  const saveTemplateDraft = useProposalStore((state) => state.saveTemplateDraft);
  const cancelTemplateEdit = useProposalStore((state) => state.cancelTemplateEdit);
  const restoreBuiltinTemplate = useProposalStore((state) => state.restoreBuiltinTemplate);

  if (templateDraft && templateDraftOrigin === "library") {
    return (
      <div className="drawer-stack">
        <div className="drawer-action-row">
          <Button icon={<ArrowLeft size={16} />} onClick={cancelTemplateEdit}>
            返回
          </Button>
          <Button variant="solid" icon={<Save size={16} />} onClick={saveTemplateDraft}>
            保存模板
          </Button>
        </div>
        {templateDraft.category === "builtin" && templateOverrides[templateDraft.id] && (
          <Button
            variant="outline"
            icon={<RotateCcw size={16} />}
            onClick={() => restoreBuiltinTemplate(templateDraft.id)}
          >
            恢复系统默认模板
          </Button>
        )}
        {templateMessage && <p className="drawer-note">{templateMessage}</p>}
        <TemplateDraftEditor />
      </div>
    );
  }

  return (
    <div className="drawer-stack">
      {templates.map((template) => (
        <article
          key={template.id}
          className={`template-card ${template.id === activeTemplateId ? "active" : ""}`}
        >
          <span>
            <strong>{template.shortName}</strong>
            <small>{template.description}</small>
          </span>
          <div className="template-card-side">
            <em>
              {template.category === "builtin"
                ? templateOverrides[template.id]
                  ? "内置已调整"
                  : "内置"
                : "自定义"}
            </em>
            <div className="template-card-actions">
              <Button onClick={() => selectTemplate(template.id)}>使用</Button>
              <Button icon={<Edit3 size={15} />} onClick={() => startTemplateEdit(template.id)}>
                调整
              </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function TemplateDraftEditor() {
  const templateDraft = useProposalStore((state) => state.templateDraft);
  const updateTemplateDraft = useProposalStore((state) => state.updateTemplateDraft);
  const addTemplateDraftSection = useProposalStore((state) => state.addTemplateDraftSection);
  const reorderTemplateDraftSections = useProposalStore((state) => state.reorderTemplateDraftSections);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!templateDraft) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderTemplateDraftSections(String(active.id), String(over.id));
  };

  return (
    <div className="template-edit-form">
      <div className="two-fields">
        <label className="field">
          <span>模板名称</span>
          <input value={templateDraft.name} onChange={(event) => updateTemplateDraft({ name: event.target.value })} />
        </label>
        <label className="field">
          <span>简称</span>
          <input
            value={templateDraft.shortName}
            onChange={(event) => updateTemplateDraft({ shortName: event.target.value })}
          />
        </label>
      </div>
      <div className="two-fields">
        <label className="field">
          <span>文档类型</span>
          <Select
            value={templateDraft.documentType}
            onChange={(event) =>
              updateTemplateDraft({ documentType: event.target.value === "请示" ? "请示" : "议案" })
            }
          >
            <option value="议案">议案</option>
            <option value="请示">请示</option>
          </Select>
        </label>
        <label className="field">
          <span>适用会议/场景</span>
          <input
            value={templateDraft.meeting}
            onChange={(event) => updateTemplateDraft({ meeting: event.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span>主送对象</span>
        <input
          value={templateDraft.recipient}
          onChange={(event) => updateTemplateDraft({ recipient: event.target.value })}
        />
      </label>
      <label className="field">
        <span>模板说明</span>
        <textarea
          value={templateDraft.description}
          onChange={(event) => updateTemplateDraft({ description: event.target.value })}
        />
      </label>
      <label className="field">
        <span>标题样式</span>
        <input
          value={templateDraft.titlePattern}
          onChange={(event) => updateTemplateDraft({ titlePattern: event.target.value })}
        />
      </label>
      <label className="field">
        <span>缘由段</span>
        <textarea
          value={templateDraft.introHint}
          onChange={(event) => updateTemplateDraft({ introHint: event.target.value })}
        />
      </label>
      <div className="drawer-action-row">
        <strong className="inline-title">模板板块</strong>
        <Button icon={<Plus size={16} />} onClick={addTemplateDraftSection}>
          新增板块
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={templateDraft.sections.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="sortable-section-list">
            {templateDraft.sections.map((section, index) => (
              <SortableTemplateSectionEditor key={section.id} section={section} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <label className="field">
        <span>默认结语</span>
        <input
          value={templateDraft.decisionSentence}
          onChange={(event) => updateTemplateDraft({ decisionSentence: event.target.value })}
        />
      </label>
      <label className="field">
        <span>附件</span>
        <textarea
          value={templateDraft.attachments}
          onChange={(event) => updateTemplateDraft({ attachments: event.target.value })}
        />
      </label>
      <label className="field">
        <span>落款</span>
        <input value={templateDraft.signer} onChange={(event) => updateTemplateDraft({ signer: event.target.value })} />
      </label>
    </div>
  );
}

function SortableTemplateSectionEditor({ section, index }: { section: Section; index: number }) {
  const updateTemplateDraftSection = useProposalStore((state) => state.updateTemplateDraftSection);
  const removeTemplateDraftSection = useProposalStore((state) => state.removeTemplateDraftSection);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`drawer-section-editor ${isDragging ? "dragging" : ""}`}
    >
      <div className="section-card-head template-section-head">
        <button className="drag-handle" type="button" {...attributes} {...listeners} title="拖拽排序">
          <GripVertical size={16} />
        </button>
        <label className="field">
          <span>{sectionNumber(index)}、板块标题</span>
          <input
            value={section.title}
            onChange={(event) => updateTemplateDraftSection(section.id, { title: event.target.value })}
          />
        </label>
        <Button icon={<Trash2 size={15} />} title="删除板块" onClick={() => removeTemplateDraftSection(section.id)} />
      </div>
      <label className="field">
        <span>板块提示词</span>
        <textarea
          value={section.prompt}
          onChange={(event) => updateTemplateDraftSection(section.id, { prompt: event.target.value })}
        />
      </label>
      <label className="field">
        <span>默认内容</span>
        <textarea
          value={section.content}
          onChange={(event) => updateTemplateDraftSection(section.id, { content: event.target.value })}
        />
      </label>
    </article>
  );
}

function DraftPanel() {
  const plainText = useProposalStore((state) => state.plainText);
  const setPlainText = useProposalStore((state) => state.setPlainText);
  const generateFromPlainText = useProposalStore((state) => state.generateFromPlainText);
  const isGenerating = useProposalStore((state) => state.isGenerating);
  const generationState = useProposalStore((state) => state.generationState);
  const aiConfig = useProposalStore((state) => state.aiConfig);

  return (
    <div className="drawer-stack">
      <label className="field">
        <span>大白话说明</span>
        <textarea
          className="large-textarea"
          value={plainText}
          onChange={(event) => setPlainText(event.target.value)}
          placeholder="说清楚事项背景、要办什么、金额/范围、程序状态、希望会议审议什么。"
        />
      </label>
      <Button
        variant="solid"
        icon={<Sparkles size={17} />}
        onClick={generateFromPlainText}
        disabled={isGenerating}
      >
        {isGenerating ? "生成中..." : "生成结构化草稿"}
      </Button>
      <p className="drawer-note">
        {hasLiveAI(aiConfig) ? "当前使用真实 BYOK 调用。" : "未配置完整 BYOK，当前使用本地模拟生成。"}
      </p>
      <p className="drawer-note">{generationState}</p>
    </div>
  );
}

function DocumentEditor() {
  const document = useProposalStore((state) => state.document);
  const updateDocument = useProposalStore((state) => state.updateDocument);
  const updateSection = useProposalStore((state) => state.updateSection);
  const reorderSections = useProposalStore((state) => state.reorderSections);
  const splitCurrentDocumentByHeadings = useProposalStore((state) => state.splitCurrentDocumentByHeadings);
  const sectionSplitMessage = useProposalStore((state) => state.sectionSplitMessage);
  const resetTemplate = useProposalStore((state) => state.resetTemplate);
  const template = useProposalStore((state) =>
    findTemplate(state.templates, state.activeTemplateId),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderSections(String(active.id), String(over.id));
  };

  return (
    <div className="drawer-stack">
      <div className="template-summary">
        <strong>{template.name}</strong>
        <span>{template.meeting}</span>
      </div>
      <label className="field">
        <span>标题</span>
        <input value={document.title} onChange={(event) => updateDocument({ title: event.target.value })} />
      </label>
      <div className="two-fields">
        <label className="field">
          <span>主送对象</span>
          <input
            value={document.recipient}
            onChange={(event) => updateDocument({ recipient: event.target.value })}
          />
        </label>
        <label className="field">
          <span>会议/场景</span>
          <input
            value={document.meeting}
            onChange={(event) => updateDocument({ meeting: event.target.value })}
          />
        </label>
      </div>
      <label className="field">
        <span>缘由段</span>
        <textarea value={document.intro} onChange={(event) => updateDocument({ intro: event.target.value })} />
      </label>

      <div className="drawer-action-row">
        <strong className="inline-title">正文板块</strong>
        <Button variant="outline" icon={<FileText size={16} />} onClick={splitCurrentDocumentByHeadings}>
          按大标题重新拆分
        </Button>
      </div>
      {sectionSplitMessage && <p className="drawer-note">{sectionSplitMessage}</p>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={document.sections.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="sortable-section-list">
            {document.sections.map((section, index) => (
              <SortableSectionEditor
                key={section.id}
                section={section}
                index={index}
                onTitleChange={(title) => updateSection(section.id, { title })}
                onContentChange={(content) => updateSection(section.id, { content })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <label className="field">
        <span>结语</span>
        <input
          value={document.closing}
          onChange={(event) => updateDocument({ closing: event.target.value })}
        />
      </label>
      <label className="field">
        <span>附件</span>
        <textarea
          value={document.attachments}
          onChange={(event) => updateDocument({ attachments: event.target.value })}
        />
      </label>
      <div className="two-fields">
        <label className="field">
          <span>落款</span>
          <input
            value={document.signer}
            onChange={(event) => updateDocument({ signer: event.target.value })}
          />
        </label>
        <label className="field">
          <span>日期</span>
          <input value={document.date} onChange={(event) => updateDocument({ date: event.target.value })} />
        </label>
      </div>
      <Button variant="outline" onClick={resetTemplate}>
        恢复当前模板默认内容
      </Button>
    </div>
  );
}

function SortableSectionEditor({
  section,
  index,
  onTitleChange,
  onContentChange,
}: {
  section: Section;
  index: number;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
}) {
  const aiConfig = useProposalStore((state) => state.aiConfig);
  const setDrawer = useProposalStore((state) => state.setDrawer);
  const [rewriteState, setRewriteState] = useState<{
    open: boolean;
    selectedText: string;
    instruction: string;
    preview: string;
    message: string;
    isGenerating: boolean;
    replaceSelection?: (replacement: string) => void;
  }>({
    open: false,
    selectedText: "",
    instruction: "",
    preview: "",
    message: "",
    isGenerating: false,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleAIRequest = (request: RichTextAIRequest) => {
    setRewriteState({
      open: true,
      selectedText: request.selectedText,
      instruction: "",
      preview: "",
      message: hasLiveAI(aiConfig) ? "" : "请先到“密钥”配置 API Key 后再使用局部 AI 修改。",
      isGenerating: false,
      replaceSelection: request.replaceSelection,
    });
  };

  const generateRewritePreview = async () => {
    if (!rewriteState.selectedText.trim()) {
      setRewriteState((state) => ({ ...state, message: "请先选择要修改的文字。" }));
      return;
    }
    if (!hasLiveAI(aiConfig)) {
      setRewriteState((state) => ({ ...state, message: "请先到“密钥”配置 API Key 后再使用局部 AI 修改。" }));
      return;
    }
    if (!rewriteState.instruction.trim()) {
      setRewriteState((state) => ({ ...state, message: "请先填写希望 AI 如何修改这段话。" }));
      return;
    }

    setRewriteState((state) => ({ ...state, isGenerating: true, message: "正在生成修改建议..." }));
    try {
      const preview = await rewriteSelectedText(aiConfig, {
        sectionTitle: section.title,
        selectedText: rewriteState.selectedText,
        instruction: rewriteState.instruction,
        context: contentToText(section.content),
      });
      setRewriteState((state) => ({
        ...state,
        preview,
        isGenerating: false,
        message: "已生成修改建议，确认后可替换选中文字。",
      }));
    } catch (error) {
      setRewriteState((state) => ({
        ...state,
        isGenerating: false,
        message: error instanceof Error ? error.message : "AI 修改失败，请稍后重试。",
      }));
    }
  };

  const closeRewritePanel = () =>
    setRewriteState({
      open: false,
      selectedText: "",
      instruction: "",
      preview: "",
      message: "",
      isGenerating: false,
    });

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`drawer-section-editor ${isDragging ? "dragging" : ""}`}
    >
      <div className="section-card-head">
        <button className="drag-handle" type="button" {...attributes} {...listeners} title="拖拽排序">
          <GripVertical size={16} />
        </button>
        <label className="field">
          <span>{sectionNumber(index)}、板块标题</span>
          <input value={section.title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
      </div>
      <p>{section.prompt}</p>
      <RichTextEditor
        value={section.content}
        onChange={onContentChange}
        placeholder="输入或润色本章节内容"
        onAIRequest={handleAIRequest}
        onAIMessage={(message) =>
          setRewriteState((state) => ({
            ...state,
            open: true,
            message,
            preview: "",
          }))
        }
      />
      {rewriteState.open && (
        <div className="section-ai-panel">
          <div className="section-ai-selection">
            <span>已选文字</span>
            <p>{rewriteState.selectedText || "请先在正文中选中要修改的文字。"}</p>
          </div>
          <label className="field">
            <span>希望 AI 怎么改</span>
            <textarea
              value={rewriteState.instruction}
              onChange={(event) =>
                setRewriteState((state) => ({
                  ...state,
                  instruction: event.target.value,
                }))
              }
              placeholder="例如：改得更正式；压缩成两句话；补充必要性语气。"
            />
          </label>
          {rewriteState.message && <p className="drawer-note">{rewriteState.message}</p>}
          {rewriteState.preview && (
            <div className="section-ai-preview">
              <span>修改预览</span>
              <p>{rewriteState.preview}</p>
            </div>
          )}
          <div className="drawer-action-row">
            <div className="template-card-actions">
              <Button
                variant="solid"
                icon={<Sparkles size={16} />}
                disabled={rewriteState.isGenerating}
                onClick={generateRewritePreview}
              >
                {rewriteState.isGenerating ? "生成中..." : rewriteState.preview ? "重新生成" : "生成预览"}
              </Button>
              {rewriteState.preview && (
                <Button
                  variant="outline"
                  onClick={() => {
                    rewriteState.replaceSelection?.(rewriteState.preview);
                    closeRewritePanel();
                  }}
                >
                  替换选区
                </Button>
              )}
            </div>
            <div className="template-card-actions">
              {!hasLiveAI(aiConfig) && (
                <Button variant="outline" onClick={() => setDrawer("ai")}>
                  去配置密钥
                </Button>
              )}
              <Button onClick={closeRewritePanel}>取消</Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function AISettingsPanel() {
  const aiConfig = useProposalStore((state) => state.aiConfig);
  const setAIConfig = useProposalStore((state) => state.setAIConfig);
  const providerId = aiConfig.providerId ?? AI_PROVIDER_PRESETS[0].id;
  const isCustom = providerId === CUSTOM_PROVIDER_ID;
  const provider = getProviderPreset(providerId);
  const modelId = findModelId(aiConfig);

  return (
    <div className="drawer-stack">
      <label className="field">
        <span>API 接口</span>
        <Select
          value={providerId}
          onChange={(event) => {
            setAIConfig(createConfigFromProvider(event.target.value, aiConfig.apiKey));
          }}
        >
          {AI_PROVIDER_PRESETS.map((item) => (
            <option value={item.id} key={item.id}>
              {item.label}
            </option>
          ))}
          <option value={CUSTOM_PROVIDER_ID}>自定义 OpenAI-compatible</option>
        </Select>
      </label>

      {!isCustom && (
        <label className="field">
          <span>模型</span>
          <Select
            value={modelId}
            onChange={(event) => setAIConfig(createConfigFromModel(aiConfig, event.target.value))}
          >
            {provider.models.map((model) => (
              <option value={model.id} key={model.id}>
                {model.label}
              </option>
            ))}
          </Select>
        </label>
      )}

      <div className="provider-summary">
        <strong>{isCustom ? "自定义接口" : provider.label}</strong>
        <span>{isCustom ? "手动填写 Base URL 和 Model。" : provider.description}</span>
        <code>{aiConfig.baseUrl || "Base URL 未填写"}</code>
        <code>{aiConfig.model || "Model 未填写"}</code>
      </div>

      {isCustom && (
        <>
          <label className="field">
            <span>Base URL</span>
            <input
              value={aiConfig.baseUrl}
              onChange={(event) => setAIConfig({ ...aiConfig, baseUrl: event.target.value })}
              placeholder="https://api.example.com"
            />
          </label>
          <label className="field">
            <span>Model</span>
            <input
              value={aiConfig.model}
              onChange={(event) => setAIConfig({ ...aiConfig, model: event.target.value })}
              placeholder="model-id"
            />
          </label>
        </>
      )}

      <label className="field">
        <span>API Key</span>
        <input
          value={aiConfig.apiKey}
          type="password"
          onChange={(event) => setAIConfig({ ...aiConfig, apiKey: event.target.value })}
          placeholder="sk-..."
        />
      </label>
      <p className="drawer-note">
        选择常用接口和模型后只需要填写 API Key。配置只保存在当前浏览器本地；未填 Key 时，AI 起草会自动走模拟结果。
      </p>
    </div>
  );
}

function WorkshopPanel() {
  const workshop = useProposalStore((state) => state.workshop);
  const templateDraft = useProposalStore((state) => state.templateDraft);
  const templateDraftOrigin = useProposalStore((state) => state.templateDraftOrigin);
  const recognitionMessage = useProposalStore((state) => state.recognitionMessage);
  const isRecognizingTemplate = useProposalStore((state) => state.isRecognizingTemplate);
  const setWorkshop = useProposalStore((state) => state.setWorkshop);
  const createCustomTemplate = useProposalStore((state) => state.createCustomTemplate);
  const recognizeWorkshopTemplate = useProposalStore((state) => state.recognizeWorkshopTemplate);
  const clearWorkshopRecognition = useProposalStore((state) => state.clearWorkshopRecognition);
  const hasRecognizedDraft = Boolean(templateDraft && templateDraftOrigin === "workshop");

  return (
    <div className="drawer-stack">
      <label className="upload-zone">
        <Upload size={18} />
        <span>{isRecognizingTemplate ? "正在识别模板..." : "上传 DOCX / MD / PDF 自动识别模板"}</span>
        <input
          type="file"
          accept=".docx,.md,.markdown,.txt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/markdown,text/plain"
          disabled={isRecognizingTemplate}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void recognizeWorkshopTemplate(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {recognitionMessage && <p className="drawer-note">{recognitionMessage}</p>}

      {!hasRecognizedDraft && (
        <>
          <label className="field">
            <span>模板名称</span>
            <input
              value={workshop.name}
              onChange={(event) => setWorkshop({ name: event.target.value })}
              placeholder="例如：资产处置类议案"
            />
          </label>
          <label className="field">
            <span>适用场景</span>
            <input
              value={workshop.scenario}
              onChange={(event) => setWorkshop({ scenario: event.target.value })}
              placeholder="例如：总办会 / 党委会"
            />
          </label>
          <label className="field">
            <span>常见事项</span>
            <input
              value={workshop.matter}
              onChange={(event) => setWorkshop({ matter: event.target.value })}
              placeholder="例如：对外投资、合同变更、资产盘活"
            />
          </label>
          <label className="field">
            <span>大致板块</span>
            <textarea
              value={workshop.sections}
              onChange={(event) => setWorkshop({ sections: event.target.value })}
              placeholder="每行一个板块，也可用顿号分隔"
            />
          </label>
        </>
      )}

      {hasRecognizedDraft && (
        <>
          <div className="drawer-action-row">
            <strong className="inline-title">识别结果</strong>
            <Button variant="outline" icon={<RotateCcw size={16} />} onClick={clearWorkshopRecognition}>
              重新手填
            </Button>
          </div>
          <TemplateDraftEditor />
        </>
      )}

      <Button variant="solid" icon={<Save size={17} />} onClick={createCustomTemplate}>
        保存为模板
      </Button>
    </div>
  );
}

function ChecksPanel() {
  const document = useProposalStore((state) => state.document);
  const checks = useFormatChecks(document);

  return (
    <div className="drawer-stack">
      <div className="check-list">
        {checks.map((check) => (
          <div className={`check-row ${check.ok ? "ok" : "warn"}`} key={check.label}>
            {check.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
      <div className="format-standard">
        <h3>格式标准</h3>
        <ul>
          {formatStandard.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ExportPanel() {
  const document = useProposalStore((state) => state.document);
  const exportMessage = useProposalStore((state) => state.exportMessage);
  const setExportMessage = useProposalStore((state) => state.setExportMessage);

  return (
    <div className="drawer-stack">
      <div className="export-actions">
        <Button
          variant="solid"
          icon={<FileText size={17} />}
          onClick={() => {
            downloadMarkdown(document);
            setExportMessage("已导出 Markdown 文件。");
          }}
        >
          Markdown
        </Button>
        <Button
          variant="outline"
          icon={<FileDown size={17} />}
          onClick={() => setExportMessage("DOCX 导出接口已预留，下一步接正式 Word 排版生成。")}
        >
          DOCX
        </Button>
        <Button
          variant="outline"
          icon={<FileArchive size={17} />}
          onClick={() => setExportMessage("PDF 导出接口已预留，下一步接浏览器打印或服务端渲染。")}
        >
          PDF
        </Button>
      </div>
      {exportMessage && <p className="drawer-note">{exportMessage}</p>}
      <details className="markdown-preview">
        <summary>查看 Markdown 输出</summary>
        <pre>{toMarkdown(document)}</pre>
      </details>
    </div>
  );
}

function AppearancePanel() {
  const document = useProposalStore((state) => state.document);
  const updateDocument = useProposalStore((state) => state.updateDocument);

  return (
    <div className="drawer-stack">
      <label className="range-field">
        <span>正文行距：{document.lineHeight} 磅</span>
        <input
          type="range"
          min="26"
          max="28"
          step="1"
          value={document.lineHeight}
          onChange={(event) => updateDocument({ lineHeight: Number(event.target.value) })}
        />
      </label>
      <p className="drawer-note">当前 demo 按公司议案/请示格式标准渲染，后续 DOCX 导出会复用同一套排版 token。</p>
    </div>
  );
}
