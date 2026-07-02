export function Footer() {
  return (
    <footer className="flex flex-col gap-1 border-t border-border px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <p>© {new Date().getFullYear()} CCB Coletas</p>
      <p>Organização e eficiência em cada coleta.</p>
    </footer>
  );
}
