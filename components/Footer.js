export default function Footer() {
  return (
    <footer className="bg-brand-950 text-slate-400 border-t border-brand-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-500 text-white font-bold text-sm">
              N
            </span>
            <span className="font-heading text-2xl font-extrabold tracking-tight text-white">
              NURSET
            </span>
          </div>

          {/* Copyright */}
          <p className="text-sm text-center sm:text-right">
            © {new Date().getFullYear()} Nurset. Тараз, Казахстан.
          </p>
        </div>
      </div>
    </footer>
  );
}
