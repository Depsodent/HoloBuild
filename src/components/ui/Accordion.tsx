import type { ReactNode } from "react";
import { ChevronRight, Pin } from "lucide-react";
import {
  MAJOR_GROUPS,
  useAccordionStore,
} from "../../workspace/accordionStore";
export function Accordion({
  id,
  title,
  children,
  forceOpen = false,
}: {
  id: string;
  title: string;
  children: ReactNode;
  forceOpen?: boolean;
}) {
  const open = useAccordionStore((s) => s.open[id] ?? false),
    setOpen = useAccordionStore((s) => s.setOpen);
  const pinned = useAccordionStore((s) => s.pinned[id] ?? false);
  const major = MAJOR_GROUPS.includes(id) && !forceOpen;
  return (
    <details
      className="workspace-accordion"
      data-accordion-key={id}
      open={forceOpen || open}
      onToggle={(e) => {
        if (!forceOpen) setOpen(id, e.currentTarget.open);
      }}
    >
      <summary
        onClick={(e) => {
          if (!forceOpen) {
            e.preventDefault();
            setOpen(id, !open);
          }
        }}
      >
        <ChevronRight size={13} aria-hidden="true" />
        <span>{title}</span>
        {major && (
          <button
            type="button"
            className="accordion-pin"
            aria-label={`Pin ${title}`}
            aria-pressed={pinned}
            title={pinned ? `Unpin ${title}` : `Keep ${title} open`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              useAccordionStore.getState().togglePin(id);
            }}
          >
            <Pin size={12} aria-hidden="true" />
          </button>
        )}
      </summary>
      <div className="accordion-content">{children}</div>
    </details>
  );
}
