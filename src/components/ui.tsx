export const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }>=({ htmlFor, children })=> (
  <label htmlFor={htmlFor} className="block text-left text-sm font-medium mb-1">{children}</label>
);