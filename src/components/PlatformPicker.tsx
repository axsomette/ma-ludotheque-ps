import { FAMILIES, PLATFORMS } from "../lib/platforms";
import type { Platform } from "../lib/types";

interface Props {
  value: Platform;
  onChange: (p: Platform) => void;
  disabled?: boolean;
}

/** Choix de la console, rangé par famille (PlayStation, Nintendo, Xbox). */
export function PlatformPicker({ value, onChange, disabled }: Props) {
  return (
    <div className="platform-picker" role="radiogroup" aria-label="Console">
      {FAMILIES.map((f) => (
        <div key={f.id} className="pp-family">
          <span className="pp-label">{f.label}</span>
          <div className="segmented small-seg">
            {f.platforms.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={value === p} className={value === p ? "on" : ""} disabled={disabled} onClick={() => value !== p && onChange(p)}>
                {PLATFORMS[p].label.replace(/^Xbox /, "")}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
