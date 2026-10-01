"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  /** dark = white text (AI page dark background), light = dark text (modal white background) */
  theme?: "dark" | "light";
  className?: string;
}

export default function MarkdownContent({
  content,
  theme = "light",
  className = "",
}: MarkdownContentProps) {
  const isDark = theme === "dark";

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // ── Headings ──────────────────────────────────────────────
        h1: ({ children }) => (
          <h1 className={`text-base font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={`text-sm font-bold mb-2 ${isDark ? "text-teal-300" : "text-slate-800"}`}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={`text-xs font-bold mb-1.5 ${isDark ? "text-teal-400" : "text-slate-700"}`}>
            {children}
          </h3>
        ),

        // ── Paragraph ─────────────────────────────────────────────
        p: ({ children }) => (
          <p className={`text-xs leading-relaxed mb-2 last:mb-0 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            {children}
          </p>
        ),

        // ── Strong / Bold ─────────────────────────────────────────
        strong: ({ children }) => (
          <strong className={`font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
            {children}
          </strong>
        ),

        // ── Em / Italic ───────────────────────────────────────────
        em: ({ children }) => (
          <em className={`italic ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {children}
          </em>
        ),

        // ── Horizontal Rule ───────────────────────────────────────
        hr: () => (
          <hr className={`my-3 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`} />
        ),

        // ── Unordered List ────────────────────────────────────────
        ul: ({ children }) => (
          <ul className="list-none space-y-1 mb-2 pl-1">
            {children}
          </ul>
        ),

        // ── Ordered List ──────────────────────────────────────────
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-2 pl-1">
            {children}
          </ol>
        ),

        // ── List Item ─────────────────────────────────────────────
        li: ({ children }) => (
          <li className={`text-xs flex items-start gap-1.5 leading-relaxed ${isDark ? "text-slate-200" : "text-slate-800"}`}>
            <span className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${isDark ? "bg-teal-400" : "bg-teal-500"}`} />
            <span>{children}</span>
          </li>
        ),

        // ── Code (inline) ─────────────────────────────────────────
        code: ({ children, className: codeClass }) => {
          const isBlock = codeClass?.includes("language-");
          if (isBlock) {
            return (
              <code
                className={`block text-[11px] font-mono p-3 rounded-lg my-2 overflow-x-auto whitespace-pre ${
                  isDark
                    ? "bg-slate-950 text-teal-300 border border-slate-700"
                    : "bg-slate-100 text-teal-700 border border-slate-200"
                }`}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                isDark
                  ? "bg-slate-700 text-teal-300"
                  : "bg-slate-100 text-teal-700 border border-slate-200"
              }`}
            >
              {children}
            </code>
          );
        },

        // ── Blockquote ────────────────────────────────────────────
        blockquote: ({ children }) => (
          <blockquote
            className={`border-l-2 pl-3 my-2 italic text-xs ${
              isDark
                ? "border-teal-500 text-slate-400 bg-slate-800/40"
                : "border-teal-500 text-slate-500 bg-slate-50"
            } rounded-r py-1`}
          >
            {children}
          </blockquote>
        ),

        // ── Table ─────────────────────────────────────────────────
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 rounded-lg border border-slate-200/20">
            <table
              className={`w-full text-[11px] border-collapse ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}
            >
              {children}
            </table>
          </div>
        ),

        thead: ({ children }) => (
          <thead
            className={isDark ? "bg-slate-800 text-teal-300" : "bg-slate-100 text-slate-700"}
          >
            {children}
          </thead>
        ),

        tbody: ({ children }) => (
          <tbody
            className={isDark ? "divide-y divide-slate-700/60" : "divide-y divide-slate-200"}
          >
            {children}
          </tbody>
        ),

        tr: ({ children }) => (
          <tr
            className={
              isDark
                ? "hover:bg-slate-700/30 transition-colors"
                : "hover:bg-slate-50 transition-colors"
            }
          >
            {children}
          </tr>
        ),

        th: ({ children }) => (
          <th
            className={`px-2.5 py-2 text-left font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap ${
              isDark ? "text-teal-300" : "text-slate-600"
            }`}
          >
            {children}
          </th>
        ),

        td: ({ children }) => (
          <td
            className={`px-2.5 py-1.5 whitespace-nowrap ${
              isDark ? "text-slate-200" : "text-slate-700"
            }`}
          >
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
