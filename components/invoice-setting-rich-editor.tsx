"use client";

import { Bold, Italic, Underline } from "lucide-react";
import { Mark, mergeAttributes } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useReducer, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { INVOICE_POINT_FONT_MAX, INVOICE_POINT_FONT_MIN, invoicePointPlainText } from "@/lib/crm/invoice-setting-html";

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

const FONT_SIZES = [12, 14, 16, 18, 24, 32, 48, 72];

/** Ukuran teks per fragmen (seperti blok di Word/Canva), disimpan sebagai `<fs pt="18">`. */
const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      pt: {
        default: null,
        parseHTML: (element) => element.getAttribute("pt"),
        renderHTML: (attributes) => (attributes.pt ? { pt: attributes.pt } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: "fs[pt]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const pt = Number(HTMLAttributes.pt);
    // style hanya untuk tampilan editor; server menyimpan atribut pt saja.
    return ["fs", mergeAttributes(HTMLAttributes, pt > 0 ? { style: `font-size:${pt}pt` } : {}), 0];
  },
});

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
  const [customSize, setCustomSize] = useState("");
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
      FontSize,
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

  const activeSize = (editor.getAttributes("fontSize").pt as string | undefined) ?? "";
  const sizes = activeSize && !FONT_SIZES.includes(Number(activeSize)) ? [...FONT_SIZES, Number(activeSize)] : FONT_SIZES;
  const customValue = Number(customSize);
  const customValid = customSize.trim() !== "" && Number.isFinite(customValue)
    && customValue >= INVOICE_POINT_FONT_MIN && customValue <= INVOICE_POINT_FONT_MAX;

  function applySize(value: string) {
    const size = Number(value);
    if (!Number.isFinite(size) || size < INVOICE_POINT_FONT_MIN || size > INVOICE_POINT_FONT_MAX) return;
    editor?.chain().focus().setMark("fontSize", { pt: String(size) }).run();
  }

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
        <NativeSelect
          size="sm"
          className="w-32"
          value={activeSize}
          aria-label="Ukuran teks"
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (value) applySize(value);
            else editor.chain().focus().unsetMark("fontSize").run();
          }}
        >
          <NativeSelectOption value="">Ukuran asli</NativeSelectOption>
          {sizes.map((size) => (
            <NativeSelectOption key={size} value={String(size)}>{size} pt</NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="number"
          min={INVOICE_POINT_FONT_MIN}
          max={INVOICE_POINT_FONT_MAX}
          step="any"
          className="h-8 w-20"
          placeholder="pt"
          value={customSize}
          aria-label="Ukuran teks bebas"
          onChange={(event) => setCustomSize(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (customValid) applySize(customSize);
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          title="Tekan Enter atau klik untuk menerapkan ukuran ke teks yang diblok"
          disabled={!customValid}
          onClick={() => applySize(customSize)}
        >
          Terapkan
        </Button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
