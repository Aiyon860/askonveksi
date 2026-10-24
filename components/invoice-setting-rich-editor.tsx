"use client";

import { Bold, Italic, Underline } from "lucide-react";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { invoicePointPlainText } from "@/lib/crm/invoice-setting-html";

const EDITOR_CLASS = [
  "invoice-point-editor min-h-40 w-full rounded-b-md border border-t-0 border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none",
  "[&_p]:mb-1 [&_p]:min-h-5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline",
].join(" ");

const PLACEHOLDER_STYLE = `
.invoice-point-editor p.is-editor-empty:first-child::before {
  color: currentColor;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  opacity: 0.5;
  pointer-events: none;
}
`;

/** HTML editor per kolom: satu paragraf = satu poin, Shift+Enter = <br> dalam poin. */
function readPoints(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.body.querySelectorAll("p"))
    .map((paragraph) => paragraph.innerHTML.trim())
    .filter((fragment) => invoicePointPlainText(fragment).length > 0);
}

export function InvoiceSettingRichEditor({
  label,
  placeholder,
  initialPoints,
  onChange,
}: {
  label: string;
  placeholder: string;
  initialPoints: string[];
  onChange: (points: string[]) => void;
}) {
  const [tick, bump] = useReducer((value: number) => value + 1, 0);
  // Konten awal dibekukan: perubahan poin dari parent tidak boleh me-reset dokumen.
  const [initialContent] = useState(() =>
    initialPoints.length ? initialPoints.map((point) => `<p>${point.replace(/\r?\n/g, "<br>")}</p>`).join("") : "<p></p>",
  );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: EDITOR_CLASS, "aria-label": label },
    },
    onUpdate: ({ editor: current }) => onChange(readPoints(current.getHTML())),
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  // Toolbar perlu ikut berubah saat kursor masuk/keluar teks berformat.
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", bump);
    return () => {
      editor.off("transaction", bump);
    };
  }, [editor]);

  if (!editor) {
    return <div className="min-h-48 animate-pulse rounded-md border border-input bg-muted/40" />;
  }

  const tools = [
    { label: "Tebal", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Miring", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Garis bawah", icon: Underline, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
  ];

  return (
    <div data-tick={tick}>
      <style>{PLACEHOLDER_STYLE}</style>
      <div className="flex flex-wrap items-center gap-1 rounded-t-md border border-input bg-muted/35 p-1">
        {tools.map((tool) => (
          <Button
            key={tool.label}
            type="button"
            size="icon-sm"
            variant={tool.active ? "secondary" : "ghost"}
            title={tool.label}
            aria-label={tool.label}
            aria-pressed={tool.active}
            onClick={tool.run}
          >
            <tool.icon aria-hidden="true" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
