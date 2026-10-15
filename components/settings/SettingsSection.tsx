import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-white/10 bg-white/[var(--panel-opacity,0.035)] px-5 py-5 md:px-6 md:py-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-black/35 text-[var(--accent)]">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
