import {
  CheckSquare,
  Download,
  FileText,
  LayoutTemplate,
  PanelRightOpen,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Languages,
} from "lucide-react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useProposalStore } from "@/store/proposal";
import { Button } from "@/components/ui/button";
import type { DrawerId } from "@/types/proposal";

const tools: Array<{ id: DrawerId; labelKey: string; icon: ReactNode; primary?: boolean }> = [
  { id: "templates", labelKey: "toolbar.templates", icon: <LayoutTemplate size={17} /> },
  { id: "draft", labelKey: "toolbar.draft", icon: <Sparkles size={17} />, primary: true },
  { id: "editor", labelKey: "toolbar.editor", icon: <PanelRightOpen size={17} /> },
  { id: "appearance", labelKey: "toolbar.appearance", icon: <SlidersHorizontal size={17} /> },
  { id: "checks", labelKey: "toolbar.checks", icon: <CheckSquare size={17} /> },
  { id: "export", labelKey: "toolbar.export", icon: <Download size={17} /> },
  { id: "ai", labelKey: "toolbar.ai", icon: <Settings size={17} /> },
  { id: "workshop", labelKey: "toolbar.workshop", icon: <Wand2 size={17} /> },
];

export function FloatingToolbar() {
  const { t, i18n } = useTranslation();
  const drawer = useProposalStore((state) => state.drawer);
  const setDrawer = useProposalStore((state) => state.setDrawer);
  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language?.startsWith("en") ? "zh-CN" : "en-US");
  };

  return (
    <motion.aside
      className="floating-toolbar"
      aria-label="工具栏"
      initial={{ opacity: 0, x: 28, translateY: "-50%" }}
      animate={{ opacity: 1, x: 0, translateY: "-50%" }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="toolbar-logo">
        <FileText size={18} />
      </div>
      {tools.map((tool) => (
        <Button
          key={tool.id}
          className={`${drawer === tool.id ? "active" : ""} ${tool.primary ? "is-primary" : ""}`}
          icon={tool.icon}
          aria-label={t(tool.labelKey)}
          title={t(tool.labelKey)}
          onClick={() => setDrawer(drawer === tool.id ? null : tool.id)}
        />
      ))}
      <Button
        icon={<Languages size={17} />}
        aria-label={t("toolbar.language")}
        title={t("toolbar.language")}
        onClick={toggleLanguage}
      />
    </motion.aside>
  );
}
