import { TraceMark } from "./TraceBrand";
export function EmptyState({
  title,
  description,
  action,
  onAction,
}: {
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <TraceMark width={48} />
      <h2>{title}</h2>
      <p>{description}</p>
      {onAction && (
        <button className="primary" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
