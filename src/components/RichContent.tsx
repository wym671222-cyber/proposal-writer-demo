import { isHtmlContent } from "@/utils/content";

export function RichContent({ value }: { value: string }) {
  if (isHtmlContent(value)) {
    return <div className="proposal-rich-content" dangerouslySetInnerHTML={{ __html: value }} />;
  }

  return (
    <>
      {value.split("\n").map((line, lineIndex) => (
        <p key={lineIndex}>{line || " "}</p>
      ))}
    </>
  );
}
