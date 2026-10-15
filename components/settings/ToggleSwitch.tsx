"use client";

import { cn } from "@/lib/cn";
import { useSettingRowLabel } from "@/components/settings/settingRowLabel";

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  id,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const labelId = useSettingRowLabel();

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : labelId}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex min-h-11 w-16 items-center rounded-full border px-1 transition",
        checked ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-white/10 bg-white/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block size-7 rounded-full bg-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition",
          checked ? "translate-x-6" : "translate-x-0",
        )}
      />
    </button>
  );
}
