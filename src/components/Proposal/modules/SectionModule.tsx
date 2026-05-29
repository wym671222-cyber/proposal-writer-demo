import { sectionNumber } from "@/components/Proposal/templates";
import { RichContent } from "@/components/RichContent";
import type { Section } from "@/types/proposal";

export function SectionModule({ section, index }: { section: Section; index: number }) {
  return (
    <section className="proposal-section">
      <h2>
        {sectionNumber(index)}、{section.title}
      </h2>
      <RichContent value={section.content} />
    </section>
  );
}
