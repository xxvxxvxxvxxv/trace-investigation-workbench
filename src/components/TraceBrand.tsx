import type { SVGProps } from "react";
export function TraceMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 36" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 18 14 7h20l11 11-11 11H14L3 18Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="m17 22 7-10 7 10H17Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="24" cy="12" r="3" fill="currentColor" />
      <circle cx="17" cy="22" r="3" fill="currentColor" />
      <circle cx="31" cy="22" r="3" fill="currentColor" />
    </svg>
  );
}
export function TraceWordmark() {
  return <span className="trace-wordmark">TRACE</span>;
}
export function TraceBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="trace-brand" aria-label="TRACE">
      <TraceMark />
      {!compact && <TraceWordmark />}
    </span>
  );
}
