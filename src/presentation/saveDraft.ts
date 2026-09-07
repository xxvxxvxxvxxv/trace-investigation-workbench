import { saveRecord } from "../db/database";
import { type Kind, type LinkSelection } from "../models/schema";
import {
  draftToValues,
  valuesToDraft,
  type DraftValues,
  type RecordView,
} from "./records";
export async function saveDraft(
  kind: Kind,
  caseId: string,
  title: string,
  values: DraftValues,
  existing?: RecordView,
  links?: LinkSelection,
): Promise<RecordView> {
  const record = await saveRecord(
    kind,
    caseId,
    title,
    draftToValues(kind, values, existing?.record.values),
    existing?.record,
    links === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(links).filter(
            ([key, ids]) =>
              !existing ||
              JSON.stringify([...ids].sort()) !==
                JSON.stringify([...(existing.links[key] ?? [])].sort()),
          ),
        ),
  );
  return {
    ...record,
    values: valuesToDraft(record.values),
    links: links ?? existing?.links ?? {},
    record,
  };
}
