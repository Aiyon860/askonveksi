"use client";

import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis teks di sini…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: true } })],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-28 w-full rounded-b-md border border-t-0 border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none focus:outline-none [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:min-h-5 [&_ul]:list-disc",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-36 animate-pulse rounded-md border border-input bg-muted/40" />;
  }

  const tools = [
    { label: "Tebal", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Miring", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Garis bawah", icon: Underline, active: editor.isActive("underline"), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: "Daftar poin", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Daftar nomor", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  function applyLink() {
    const url = linkUrl.trim();
    if (!editor || !/^(https?:\/\/|mailto:|tel:)/i.test(url)) return;
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    setLinkOpen(false);
    setLinkUrl("");
  }

  return (
    <div>
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
        <Button
          type="button"
          size="icon-sm"
          variant={editor.isActive("link") ? "secondary" : "ghost"}
          title="Tautan"
          aria-label="Tautan"
          onClick={() => setLinkOpen((current) => !current)}
        >
          <Link2 aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          title="Hapus format"
          aria-label="Hapus format"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting aria-hidden="true" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <Button type="button" size="icon-sm" variant="ghost" title="Urungkan" aria-label="Urungkan" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 aria-hidden="true" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" title="Ulangi" aria-label="Ulangi" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 aria-hidden="true" />
        </Button>
      </div>
      {linkOpen ? (
        <div className="flex items-center gap-2 border-x border-input bg-muted/20 p-2">
          <Input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://contoh.com"
            className="h-8"
            aria-label="Alamat tautan"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <Button type="button" size="sm" onClick={applyLink}>
            Pasang
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label="Tutup" onClick={() => setLinkOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}
