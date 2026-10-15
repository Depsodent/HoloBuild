import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useAccordionStore } from "../../workspace/accordionStore";
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
  return (
    <details
      className="workspace-accordion"
      data-accordion-key={id}
      open={forceOpen || open}
      onToggle={(e) => {
        if (!forceOpen) setOpen(id, e.currentTarget.open);
      }}
    >
      <summary>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{title}</span>
      </summary>
      <div className="accordion-content">{children}</div>
    </details>
  );
}
