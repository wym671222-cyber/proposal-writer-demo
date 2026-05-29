import { useMemo } from "react";
import { buildChecks } from "@/services/proposal";
import type { ProposalDocument } from "@/types/proposal";

export function useFormatChecks(document: ProposalDocument) {
  return useMemo(() => buildChecks(document), [document]);
}
