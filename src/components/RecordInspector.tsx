import { useEffect, useState, type ComponentProps } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { RecordDetailContent } from "./Details";
import { ModalShell } from "./ModalShell";
export function RecordInspector({
  back,
  forward,
  ...props
}: ComponentProps<typeof RecordDetailContent> & {
  back?: () => void;
  forward?: () => void;
}) {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 1100px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const change = () => setNarrow(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) props.onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [props]);
  const content = (
    <>
      <div className="inspector-history">
        <span className="eyebrow">RECORD INSPECTOR</span>
        <button
          className="icon-button"
          aria-label="Previous inspected record"
          disabled={!back}
          onClick={back}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Next inspected record"
          disabled={!forward}
          onClick={forward}
        >
          <ArrowRight size={16} />
        </button>
      </div>
      <RecordDetailContent {...props} />
    </>
  );
  return narrow ? (
    <ModalShell className="detail inspector-drawer" onClose={props.onClose}>
      {content}
    </ModalShell>
  ) : (
    <aside className="record-inspector" aria-label="Record inspector">
      {content}
    </aside>
  );
}
