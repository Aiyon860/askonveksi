"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type MessageVariable = { name: string; label: string };

const VARIABLE_PATTERN = /\{\{([a-z0-9_]+)\}\}/gi;

const EDITOR_CLASS = [
  "broadcast-message-editor min-h-40 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm leading-6 shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "[&_p]:m-0 [&_p]:min-h-6",
].join(" ");

const PLACEHOLDER_STYLE = `
.broadcast-message-editor p.is-editor-empty:first-child::before {
  color: currentColor;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  opacity: 0.5;
  pointer-events: none;
}
`;

/** Satu variabel template dirender sebagai pil yang tidak bisa diedit sebagian. */
const MessageVariableNode = Node.create({
  name: "messageVariable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-variable") ?? "",
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-variable]" }];
  },
  renderHTML({ node }) {
    return [
      "span",
      mergeAttributes({ "data-variable": String(node.attrs.name) }),
      `{{${String(node.attrs.name)}}}`,
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MessageVariablePill);
  },
});

function MessageVariablePill({ node, deleteNode, selected }: NodeViewProps) {
  const name = String(node.attrs.name ?? "");
  return (
    <NodeViewWrapper
      as="span"
      data-variable={name}
      className={cn(
        "mx-0.5 inline-flex select-none items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 align-middle text-xs font-medium text-primary",
        selected && "ring-2 ring-ring/60",
      )}
    >
      <span contentEditable={false}>{`{{${name}}}`}</span>
      <button
        type="button"
        contentEditable={false}
        aria-label={`Hapus variabel ${name}`}
        onClick={() => deleteNode()}
        className="-mr-0.5 grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </NodeViewWrapper>
  );
}

/** Ubah teks template (dengan token `{{variabel}}`) menjadi dokumen editor. */
function messageToDocument(message: string) {
  const lines = message.split("\n");
  return {
    type: "doc",
    content: lines.map((line) => {
      const content: Array<Record<string, unknown>> = [];
      let cursor = 0;
      for (const match of line.matchAll(VARIABLE_PATTERN)) {
        const index = match.index ?? 0;
        if (index > cursor) content.push({ type: "text", text: line.slice(cursor, index) });
        content.push({ type: "messageVariable", attrs: { name: match[1] } });
        cursor = index + match[0].length;
      }
      if (cursor < line.length) content.push({ type: "text", text: line.slice(cursor) });
      return content.length ? { type: "paragraph", content } : { type: "paragraph" };
    }),
  };
}

function messageFromEditor(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const lines: string[] = [];
  editor.state.doc.forEach((paragraph) => {
    let line = "";
    paragraph.forEach((child) => {
      if (child.type.name === "messageVariable") line += `{{${String(child.attrs.name)}}}`;
      else if (child.type.name === "hardBreak") line += "\n";
      else if (child.isText) line += child.text ?? "";
    });
    lines.push(line);
  });
  return lines.join("\n");
}

/**
 * Pesan broadcast dengan variabel berupa pil: pilih dari daftar di bawah area
 * tulis, pil langsung masuk ke pesan, dan bisa dihapus lewat tombol silang atau
 * Backspace. Nilai yang dikirim ke server tetap teks `{{variabel}}`.
 */
export function BroadcastMessageEditor({
  id,
  name,
  value,
  onChange,
  variables,
  placeholder,
  rows = 8,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  variables: readonly MessageVariable[];
  placeholder?: string;
  rows?: number;
}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        link: false,
        listItem: false,
        listKeymap: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      MessageVariableNode,
    ],
    content: messageToDocument(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        class: EDITOR_CLASS,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Pesan broadcast",
        style: `min-height: ${Math.max(rows, 4) * 1.5}rem`,
      },
    },
    onUpdate: ({ editor: current }) => onChangeRef.current(messageFromEditor(current)),
  });

  // Draf terakhir dibaca dari localStorage setelah mount; editor harus ikut
  // memuatnya tanpa menimpa ketikan user.
  useEffect(() => {
    const activeEditor = editor;
    if (!activeEditor) return;
    if (messageFromEditor(activeEditor) === value) return;
    activeEditor.commands.setContent(messageToDocument(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    return () => editor?.destroy();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-40 animate-pulse rounded-md border border-input bg-muted/40" />;
  }

  function insertVariable(variable: MessageVariable) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent([
        { type: "messageVariable", attrs: { name: variable.name } },
        { type: "text", text: " " },
      ])
      .run();
    onChangeRef.current(messageFromEditor(editor));
  }

  return (
    <div className="grid min-w-0 gap-2">
      <style>{PLACEHOLDER_STYLE}</style>
      <input type="hidden" name={name} value={value} />
      <EditorContent editor={editor} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Sisipkan variabel:</span>
        {variables.map((variable) => (
          <button
            key={variable.name}
            type="button"
            title={variable.label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertVariable(variable)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {`{{${variable.name}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
