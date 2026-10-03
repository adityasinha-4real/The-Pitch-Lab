"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { CalendarCheck, LayoutDashboard, LogOut, Menu, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ThemeToggle } from "./theme-controls";

type NavUser = { name: string | null; email: string; role: "user" | "admin" } | null;

const LINKS = [
  { href: "/turfs", label: "Turfs" },
  { href: "/games", label: "Open games" },
  { href: "/bookings", label: "My bookings" },
];

function initials(user: NonNullable<NavUser>) {
  const source = user.name?.trim() || user.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

export function HeaderNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? "page" : undefined}
            className={cn(
              "relative inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors",
              isActive(l.href) ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {isActive(l.href) && (
              <motion.span
                layoutId="nav-active"
                className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-accent"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {l.label}
          </Link>
        ))}
        {user?.role === "admin" && (
          <Link
            href="/admin"
            aria-current={isActive("/admin") ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-semibold transition-colors",
              isActive("/admin") ? "text-accent-fg" : "text-muted hover:text-text",
            )}
          >
            Admin
          </Link>
        )}
      </nav>

      <ThemeToggle />

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className="hidden size-11 place-items-center rounded-xl bg-accent font-display text-lg font-extrabold text-accent-ink md:grid"
            aria-label="Account menu"
          >
            {initials(user)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <span className="block font-semibold text-text">{user.name ?? "Player"}</span>
              {user.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/bookings">
                <CalendarCheck /> My bookings
              </Link>
            </DropdownMenuItem>
            {user.role === "admin" && (
              <DropdownMenuItem asChild>
                <Link href="/admin">
                  <LayoutDashboard /> Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut /> Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button asChild size="sm" className="hidden md:inline-flex">
          <Link href={`/signin?next=${encodeURIComponent(pathname)}`}>Sign in</Link>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="!size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription className="sr-only">Site navigation</DialogDescription>
          <nav aria-label="Mobile" className="mt-5 flex flex-col gap-1">
            {[...LINKS, ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : [])].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={cn(
                  "flex min-h-13 items-center justify-between rounded-2xl px-4 font-display text-2xl font-extrabold uppercase",
                  isActive(l.href) ? "bg-accent text-accent-ink" : "hover:bg-surface-2",
                )}
              >
                {l.label}
                {l.href === "/games" && <Users className="size-5" aria-hidden />}
              </Link>
            ))}
          </nav>
          <div className="mt-5 border-t border-line-strong pt-5">
            {user ? (
              <form action="/auth/signout" method="post" className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-muted">{user.email}</span>
                <Button type="submit" variant="secondary" size="sm">
                  <LogOut /> Sign out
                </Button>
              </form>
            ) : (
              <Button asChild className="w-full">
                <Link href={`/signin?next=${encodeURIComponent(pathname)}`} onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
