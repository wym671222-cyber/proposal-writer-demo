export type Section = {
  id: string;
  title: string;
  prompt: string;
  content: string;
};

export type ProposalTemplate = {
  id: string;
  name: string;
  shortName: string;
  category: "builtin" | "custom";
  documentType: "请示" | "议案";
  meeting: string;
  recipient: string;
  description: string;
  titlePattern: string;
  introHint: string;
  sections: Section[];
  decisionSentence: string;
  signer: string;
  attachments: string;
};

export type TemplateOverrides = Record<string, ProposalTemplate>;

export type TemplateDraftOrigin = "library" | "workshop";

export type ProposalDocument = {
  templateId: string;
  title: string;
  recipient: string;
  meeting: string;
  intro: string;
  sections: Section[];
  closing: string;
  attachments: string;
  signer: string;
  date: string;
  lineHeight: number;
};

export type AIConfig = {
  providerId?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type WorkshopForm = {
  name: string;
  scenario: string;
  matter: string;
  sections: string;
};

export type RecognizedTemplateResult = {
  template: ProposalTemplate;
  message: string;
  rawText: string;
};

export type DrawerId =
  | "templates"
  | "editor"
  | "draft"
  | "ai"
  | "workshop"
  | "checks"
  | "export"
  | "appearance";

export type CheckItem = {
  label: string;
  ok: boolean;
};
