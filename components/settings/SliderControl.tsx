import { useSettingRowLabel } from "@/components/settings/settingRowLabel";

export function SliderControl({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  suffix = "",
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  suffix?: string;
}) {
  const labelId = useSettingRowLabel();

  return (
    <label className="flex min-h-11 min-w-[220px] items-center gap-3 rounded-full border border-white/10 bg-black/45 px-4 text-sm font-semibold text-white">
      <span className="min-w-10 text-right tabular-nums">
        {value}
        {suffix}
      </span>
      <input
        aria-label={label}
        aria-labelledby={label ? undefined : labelId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </label>
  );
}
