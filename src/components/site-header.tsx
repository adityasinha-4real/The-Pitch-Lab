import { getSessionUser } from "@/server/auth";
import { Logo } from "./brand";
import { HeaderNav } from "./header-nav";

export async function SiteHeader() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <HeaderNav user={user ? { name: user.name, email: user.email, role: user.role } : null} />
      </div>
    </header>
  );
}
