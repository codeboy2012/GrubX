import { useSettingRowLabel } from "@/components/settings/settingRowLabel";

export function SelectControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}) {
  const labelId = useSettingRowLabel();

  return (
    <select
      aria-label={label}
      aria-labelledby={label ? undefined : labelId}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="min-h-11 rounded-full border border-white/10 bg-black/45 px-4 text-sm font-semibold text-white outline-none"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
