export function FormPills({ form }: { form: ("W" | "D" | "L")[] }) {
  return (
    <span>
      {form.map((r, i) => (
        <span key={i} className={`pill pill-${r}`}>{r}</span>
      ))}
    </span>
  );
}
