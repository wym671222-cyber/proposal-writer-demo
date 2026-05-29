import type { AIConfig } from "@/types/proposal";

export type AIModelPreset = {
  id: string;
  label: string;
  model: string;
  description?: string;
};

export type AIProviderPreset = {
  id: string;
  label: string;
  description: string;
  baseUrl: string;
  models: AIModelPreset[];
};

export const CUSTOM_PROVIDER_ID = "custom";

export const AI_PROVIDER_PRESETS: AIProviderPreset[] = [
  {
    id: "deepseek",
    label: "DeepSeek 官方",
    description: "适合中文正式文稿，成本较低。",
    baseUrl: "https://api.deepseek.com",
    models: [
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", model: "deepseek-v4-flash" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", model: "deepseek-v4-pro" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "通用能力强，适合复杂润色和结构化输出。",
    baseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-5.5", label: "GPT-5.5", model: "gpt-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4", model: "gpt-5.4" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", model: "gpt-5.4-mini" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano", model: "gpt-5.4-nano" },
    ],
  },
  {
    id: "qwen",
    label: "通义千问 DashScope",
    description: "阿里云 OpenAI 兼容模式。",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen3.7-max", label: "Qwen3.7 Max", model: "qwen3.7-max" },
      { id: "qwen3.6-plus", label: "Qwen3.6 Plus", model: "qwen3.6-plus" },
      { id: "qwen3.6-flash", label: "Qwen3.6 Flash", model: "qwen3.6-flash" },
    ],
  },
  {
    id: "moonshot",
    label: "Kimi / Moonshot",
    description: "适合长文本理解与中文公文处理。",
    baseUrl: "https://api.moonshot.ai/v1",
    models: [
      { id: "kimi-k2.6", label: "Kimi K2.6", model: "kimi-k2.6" },
      { id: "kimi-k2.5", label: "Kimi K2.5", model: "kimi-k2.5" },
      { id: "moonshot-v1-128k", label: "Moonshot v1 128K", model: "moonshot-v1-128k" },
    ],
  },
  {
    id: "siliconflow",
    label: "硅基流动",
    description: "可选择 DeepSeek、Kimi、GLM 等模型。",
    baseUrl: "https://api.siliconflow.com/v1",
    models: [
      { id: "sf-deepseek-v4-flash", label: "DeepSeek V4 Flash", model: "deepseek-ai/DeepSeek-V4-Flash" },
      { id: "sf-deepseek-v4-pro", label: "DeepSeek V4 Pro", model: "deepseek-ai/DeepSeek-V4-Pro" },
      { id: "sf-kimi-k2.6", label: "Kimi K2.6", model: "moonshotai/Kimi-K2.6" },
      { id: "sf-glm-5.1", label: "GLM 5.1", model: "zai-org/GLM-5.1" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    description: "聚合模型网关，适合测试多模型。",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      { id: "openrouter-gpt-5.5", label: "GPT-5.5", model: "openai/gpt-5.5" },
      { id: "openrouter-gpt-5.4-mini", label: "GPT-5.4 mini", model: "openai/gpt-5.4-mini" },
      { id: "openrouter-deepseek-v4-pro", label: "DeepSeek V4 Pro", model: "deepseek/deepseek-v4-pro" },
      { id: "openrouter-qwen3.7-max", label: "Qwen3.7 Max", model: "qwen/qwen3.7-max" },
    ],
  },
];

export function getProviderPreset(providerId?: string) {
  return AI_PROVIDER_PRESETS.find((provider) => provider.id === providerId) ?? AI_PROVIDER_PRESETS[0];
}

export function getDefaultModel(providerId?: string) {
  return getProviderPreset(providerId).models[0];
}

export function createConfigFromProvider(providerId: string, apiKey = ""): AIConfig {
  if (providerId === CUSTOM_PROVIDER_ID) {
    return {
      providerId: CUSTOM_PROVIDER_ID,
      apiKey,
      baseUrl: "",
      model: "",
    };
  }

  const provider = getProviderPreset(providerId);
  const model = provider.models[0];
  return {
    providerId: provider.id,
    apiKey,
    baseUrl: provider.baseUrl,
    model: model.model,
  };
}

export function createConfigFromModel(config: AIConfig, modelId: string): AIConfig {
  const provider = getProviderPreset(config.providerId);
  const model = provider.models.find((item) => item.id === modelId) ?? provider.models[0];
  return {
    ...config,
    baseUrl: provider.baseUrl,
    model: model.model,
  };
}

export function findModelId(config: AIConfig) {
  const provider = getProviderPreset(config.providerId);
  return provider.models.find((model) => model.model === config.model)?.id ?? provider.models[0].id;
}

export function normalizeAIConfig(config: AIConfig): AIConfig {
  if (config.providerId === CUSTOM_PROVIDER_ID) return config;
  const providerById = AI_PROVIDER_PRESETS.find((provider) => provider.id === config.providerId);
  if (providerById) {
    const currentModel = providerById.models.find((model) => model.model === config.model);
    return {
      ...config,
      providerId: providerById.id,
      baseUrl: providerById.baseUrl,
      model: currentModel?.model ?? providerById.models[0].model,
    };
  }
  const matchedProvider = AI_PROVIDER_PRESETS.find((provider) => {
    return provider.baseUrl === config.baseUrl || provider.models.some((model) => model.model === config.model);
  });
  if (matchedProvider) {
    return {
      ...config,
      providerId: matchedProvider.id,
      baseUrl: config.baseUrl || matchedProvider.baseUrl,
      model: config.model || matchedProvider.models[0].model,
    };
  }
  if (config.baseUrl || config.model) {
    return {
      ...config,
      providerId: CUSTOM_PROVIDER_ID,
    };
  }
  return createConfigFromProvider(AI_PROVIDER_PRESETS[0].id, config.apiKey);
}
