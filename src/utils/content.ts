export function isHtmlContent(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

export function textToHtml(value: string) {
  const lines = value.split("\n");
  return lines.map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`).join("");
}

export function contentToText(value: string) {
  if (!isHtmlContent(value)) return value;
  const doc = new DOMParser().parseFromString(value, "text/html");
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("li").forEach((li) => {
    li.append("\n");
  });
  doc.querySelectorAll("p, h1, h2, h3").forEach((node) => {
    node.append("\n");
  });
  return (doc.body.textContent ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function contentToMarkdown(value: string) {
  if (!isHtmlContent(value)) return value;
  const doc = new DOMParser().parseFromString(value, "text/html");
  const chunks: string[] = [];

  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) chunks.push(text);
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "UL" || node.tagName === "OL") {
      const ordered = node.tagName === "OL";
      Array.from(node.querySelectorAll("li")).forEach((li, index) => {
        chunks.push(`${ordered ? `${index + 1}.` : "-"} ${li.textContent?.trim() ?? ""}`);
      });
      return;
    }
    const text = node.textContent?.trim();
    if (text) chunks.push(text);
  });

  return chunks.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
