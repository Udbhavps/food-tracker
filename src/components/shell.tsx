"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/", label: "Map", icon: "🗺️" },
  { href: "/list", label: "List", icon: "📋" },
  { href: "/near", label: "Near me", icon: "📍" },
  { href: "/add", label: "Add", icon: "➕" },
];

export function Shell({ title, children, wide = false }: { title: string; children: ReactNode; wide?: boolean }) {
  const path = usePathname();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[1100] border-b border-zinc-200 bg-background/95 px-4 py-3 backdrop-blur dark:border-zinc-800">
        <h1 className="mx-auto max-w-2xl text-lg font-semibold tracking-tight">{title}</h1>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-4 pb-24 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[1100] border-t border-zinc-200 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((t) => {
            const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                    active ? "font-semibold text-orange-600" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
