"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item, i) => {
        const open = openIdx === i;
        return (
          <div key={item.q} className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800"
              aria-expanded={open}
            >
              {item.q}
              <ChevronDown
                size={18}
                className={`shrink-0 text-vnpt transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && <p className="px-4 pb-3 text-sm text-slate-500">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
