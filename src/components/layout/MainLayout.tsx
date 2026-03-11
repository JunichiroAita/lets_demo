import { Header } from './Header';

type MainLayoutProps = {
  children: React.ReactNode;
};

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <Header />
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-8">{children}</main>
    </div>
  );
}
