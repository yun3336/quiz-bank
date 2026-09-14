export function SegRadios({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: { id: string; label: string }[];
  onChange?: (id: string) => void;
}) {
  return (
    <div className="qb-seg">
      {options.map((item) => (
        <label key={item.id}>
          <input
            type="radio"
            name={name}
            value={item.id}
            defaultChecked={value === item.id}
            onChange={() => onChange?.(item.id)}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}
