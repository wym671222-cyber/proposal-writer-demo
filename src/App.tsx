import { EditorDrawer } from "@/components/Editor";
import { ProposalView } from "@/components/Proposal";
import { FloatingToolbar } from "@/components/Toolbar/FloatingToolbar";
import { useProposalStore } from "@/store/proposal";
import { findTemplate } from "@/services/proposal";
import { useTranslation } from "react-i18next";

export function App() {
  const { t } = useTranslation();
  const template = useProposalStore((state) => findTemplate(state.templates, state.activeTemplateId));
  const generationState = useProposalStore((state) => state.generationState);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">议</div>
          <div>
            <h1>{t("app.name")}</h1>
            <p>{template.name || t("app.subtitle")}</p>
          </div>
        </div>
        <div className="status-strip">
          <span>{template.documentType}</span>
          <span>{template.meeting}</span>
          <strong>{generationState}</strong>
        </div>
      </header>

      <ProposalView />
      <FloatingToolbar />
      <EditorDrawer />
    </main>
  );
}
