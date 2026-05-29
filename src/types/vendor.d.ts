declare module "mammoth" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

declare module "pdfjs-dist/legacy/build/pdf.mjs" {
  export type TextContent = {
    items: Array<{ str?: string }>;
  };

  export type PDFPageProxy = {
    getTextContent(): Promise<TextContent>;
  };

  export type PDFDocumentProxy = {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  };

  export function getDocument(options: {
    data: Uint8Array;
    disableWorker?: boolean;
    useWorkerFetch?: boolean;
    isEvalSupported?: boolean;
  }): {
    promise: Promise<PDFDocumentProxy>;
  };
}
