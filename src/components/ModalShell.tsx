import { useEffect, useRef, type ReactNode } from "react";
export function ModalShell({
  className,
  onClose,
  children,
}: {
  className: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={onClose}
      aria-label={
        className.includes("editor")
          ? "Record editor"
          : className.includes("relationship")
            ? "Relationship editor"
            : "Record details"
      }
    >
      {children}
    </dialog>
  );
}
