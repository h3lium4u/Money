"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string; // If omitted, renders as plain text (current page)
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex items-center gap-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              )}
              {isLast || !item.href ? (
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-slate-500 dark:text-slate-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
