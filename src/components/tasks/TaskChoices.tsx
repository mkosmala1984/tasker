import { useId } from "react";
import type { CSSProperties } from "react";

type Props<T extends string> = {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; color?: string }>;
  onChange: (value: T) => void;
  error?: string;
  tone?: "person";
};

export function TaskChoices<T extends string>({ label, value, options, onChange, error, tone }: Props<T>) {
  const errorId = useId();
  return (
    <fieldset className="task-choice-group" aria-invalid={!!error} aria-describedby={error ? errorId : undefined}>
      <legend>{label}</legend>
      <div className="task-choice-options">
        {options.map((option, index) => (
          <button key={option.value} type="button" className="task-choice" data-tone={tone ? index % 4 : undefined}
            data-category-color={option.color ? true : undefined}
            style={option.color ? { "--task-choice-color": option.color } as CSSProperties : undefined}
            aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
            {option.color ? <span className="task-choice-color" aria-hidden="true" /> : null}
            {value === option.value ? <span aria-hidden="true">✓ </span> : null}{option.label}
          </button>
        ))}
      </div>
      {error ? <p className="task-field-error" id={errorId} role="alert">{error}</p> : null}
    </fieldset>
  );
}
