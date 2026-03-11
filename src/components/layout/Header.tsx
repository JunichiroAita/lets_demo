export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-6xl flex h-14 items-center px-4">
        <a href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <span className="text-lg">lets_web</span>
        </a>
        <nav className="ml-6 flex gap-6 text-sm text-gray-600">
          <a href="#" className="transition-colors hover:text-gray-900">
            ホーム
          </a>
          <a href="#" className="transition-colors hover:text-gray-900">
            について
          </a>
        </nav>
      </div>
    </header>
  );
}
