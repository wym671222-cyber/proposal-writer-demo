import { useProposalStore } from "@/store/proposal";
import type { CSSProperties } from "react";
import { SectionModule } from "./modules/SectionModule";

export function ProposalView() {
  const document = useProposalStore((state) => state.document);

  return (
    <div className="document-stage">
      <div className="page-shadow">
        <article
          className="proposal-page"
          style={{ "--doc-line-height": `${document.lineHeight}pt` } as CSSProperties}
        >
          <h1>{document.title}</h1>
          <p className="recipient">{document.recipient}：</p>
          <p>{document.intro}</p>
          {document.sections.map((section, index) => (
            <SectionModule key={section.id} section={section} index={index} />
          ))}
          <p>{document.closing}</p>
          {document.attachments.trim() && (
            <div className="attachments">
              <p>附件：{document.attachments.split("\n")[0]}</p>
              {document.attachments
                .split("\n")
                .slice(1)
                .map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
            </div>
          )}
          <div className="signature">
            <p>{document.signer}</p>
            <p>{document.date}</p>
          </div>
        </article>
      </div>
    </div>
  );
}
