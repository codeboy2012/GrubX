import { useSettingRowLabel } from "@/components/settings/settingRowLabel";

export function TextInputControl({
  value,
  onChange,
  placeholder,
  label,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  type?: "text" | "url" | "color";
}) {
  const labelId = useSettingRowLabel();

  return (
    <input
      aria-label={label}
      aria-labelledby={label ? undefined : labelId}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-11 w-full min-w-[220px] rounded-full border border-white/10 bg-black/45 px-4 text-sm font-semibold text-white outline-none placeholder:text-white/35 sm:w-auto"
    />
  );
}
