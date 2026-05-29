import type { ProposalDocument, ProposalTemplate, WorkshopForm } from "@/types/proposal";

const today = new Date().toLocaleDateString("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export const builtinTemplates: ProposalTemplate[] = [
  {
    id: "purchase-initiation",
    name: "年度计划外项目采购立项请示",
    shortName: "采购立项请示",
    category: "builtin",
    documentType: "请示",
    meeting: "公司领导审议",
    recipient: "公司领导",
    description: "适用于年度计划外工程、货物或服务采购事项的立项申请。",
    titlePattern: "关于公司年度计划外XX项目采购立项的请示",
    introHint:
      "鉴于（具体原因），XX项目需要采购XX（工程、货物或服务）。由于本次采购属于公司年度计划外的采购事项，故特向领导提出采购立项申请，详细内容汇报如下：",
    sections: [
      {
        id: "background",
        title: "事项现状（背景）",
        prompt: "说明事项当前状态、问题来源、工作背景和采购触发原因。",
        content: "请补充该采购事项的现状、背景情况及形成原因。",
      },
      {
        id: "purpose",
        title: "采购立项目的",
        prompt: "说明采购希望解决的问题、支撑的业务目标或管理目标。",
        content: "请说明本次采购立项拟达成的目标和预期作用。",
      },
      {
        id: "necessity",
        title: "采购立项必要性",
        prompt: "说明不采购的影响、采购的必要性、紧迫性和依据。",
        content: "请从业务需要、合规要求、实施时限等方面说明必要性。",
      },
      {
        id: "scope",
        title: "项目采购内容",
        prompt: "列明项目名称、采购内容、预估金额、采购方式等要素。",
        content:
          "（一）项目名称：XX项目\n（二）采购内容：XX\n（三）预估金额：XX万元\n（四）采购方式：XX",
      },
      {
        id: "decision",
        title: "提请审议事项",
        prompt: "形成明确、可表决的审议事项。",
        content: "同意XXXX提请年度计划外XX项目采购立项请示，并按请示内容执行。",
      },
    ],
    decisionSentence: "请予审议。",
    signer: "深圳市安居建业投资运营有限公司",
    attachments: "1. 市场调研同类情况/询价情况（如有）",
  },
  {
    id: "subsidiary-meeting",
    name: "参控股公司上报总办会（党委会）议案",
    shortName: "参控股上会议案",
    category: "builtin",
    documentType: "议案",
    meeting: "党支委会、总办会",
    recipient: "公司领导",
    description: "适用于参控股公司需上报平台公司内部会议审议的事项。",
    titlePattern: "关于审议深圳市安和二号房地产开发有限公司XXXX的议案",
    introHint:
      "近日，公司收到参股公司报送的会议通知，会议涉及相关议题。前期总部相关职能中心已对报送议题进行研讨，并经协管领导组织专题会审核，现将该议题上报公司党支委会、总办会审议，有关情况汇报如下：",
    sections: [
      {
        id: "core",
        title: "议案事项的核心内容",
        prompt: "概括参控股公司上报议案的核心内容、关键安排和需决策事项。",
        content: "请阐述上报议案的核心内容及需平台公司决策的事项。",
      },
      {
        id: "necessity",
        title: "议案事项的开展必要性",
        prompt: "说明事项开展的业务必要性、合规必要性和对公司治理的影响。",
        content: "请说明本议案所涉事项的必要性。",
      },
      {
        id: "department-opinion",
        title: "平台（安居建业）职能中心意见",
        prompt: "归纳牵头单位及相关部门专业审议意见、依据、修改前后对比。",
        content:
          "（一）修改《XX协议》中第X条第X款\n原内容：\n修改为：\n修改依据：如佐证或参考材料篇幅较长，以附件形式保留至文后。",
      },
      {
        id: "procedure",
        title: "履行内部审议程序情况",
        prompt: "列明事项在参控股公司、平台专题会等内部程序中的审议情况。",
        content:
          "202X年X月X日，《XXXX的议案》通过相关公司总经理办公会审议，会议纪要见附件X。\n202X年X月X日，《XXXX的议案》通过平台公司专题会审议，会议纪要见附件X。",
      },
      {
        id: "decision",
        title: "提请审议事项",
        prompt: "形成明确授权和表决意见，便于会议审议。",
        content:
          "同意深圳市安和城市更新投资运营有限公司提请审议的《XXXX的议案》，同意授权公司相关派出董事对该议案投同意票并签署决议文件。",
      },
    ],
    decisionSentence: "请予审议。",
    signer: "牵头部门、城市更新事业部",
    attachments: "1. XXXX",
  },
];

export const formatStandard = [
  "标题：方正小标宋简体，二号，居中，不加粗，末尾不加标点。",
  "一级标题：黑体，三号，首行缩进2字符。",
  "二级标题：楷体_GB2312，三号，加粗，首行缩进2字符。",
  "三级标题：仿宋_GB2312，三号，加粗，首行缩进2字符。",
  "正文：仿宋_GB2312，三号，首行缩进2字符。",
  "编号顺序：一、→（一）→1.→（1）→①→a。",
  "全文行距默认28磅，可在26-28磅内调整。",
];

export function createDocumentFromTemplate(template: ProposalTemplate): ProposalDocument {
  return {
    templateId: template.id,
    title: template.titlePattern,
    recipient: template.recipient,
    meeting: template.meeting,
    intro: template.introHint,
    sections: template.sections.map((section) => ({ ...section })),
    closing: template.decisionSentence,
    attachments: template.attachments,
    signer: template.signer,
    date: today,
    lineHeight: 28,
  };
}

export function createTemplateFromWorkshop(form: WorkshopForm): ProposalTemplate {
  const rawSections = form.sections
    .split(/[\n,，、；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const fallbackSections = ["基本情况", "事项必要性", "主要内容", "风险及建议", "提请审议事项"];
  const sections = (rawSections.length ? rawSections : fallbackSections).map((title, index) => ({
    id: `custom-${Date.now()}-${index}`,
    title,
    prompt: `围绕“${form.matter || form.scenario || form.name}”补充${title}相关事实、依据和建议。`,
    content: `请补充${title}。`,
  }));

  return {
    id: `custom-${Date.now()}`,
    name: form.name.trim() || "自定义议案模板",
    shortName: form.name.trim() || "自定义模板",
    category: "custom",
    documentType: "议案",
    meeting: form.scenario.trim() || "内部会议审议",
    recipient: "公司领导",
    description: form.matter.trim() || "由模板工坊生成的自定义议案模板。",
    titlePattern: `关于${form.name.trim() || "相关事项"}的议案`,
    introHint: `根据${form.scenario.trim() || "内部审议"}工作安排，现就相关事项提请审议，具体情况如下：`,
    sections,
    decisionSentence: "请予审议。",
    signer: "深圳市安居建业投资运营有限公司",
    attachments: "1. 相关佐证材料",
  };
}

export function sectionNumber(index: number) {
  return ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][index] ?? `${index + 1}`;
}
