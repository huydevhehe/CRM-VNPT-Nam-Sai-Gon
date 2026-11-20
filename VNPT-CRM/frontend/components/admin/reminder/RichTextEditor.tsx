"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { BackgroundColor, Color, TextStyle } from "@tiptap/extension-text-style";
import {
  Bold,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from "lucide-react";

export interface RichTextEditorHandle {
  /** Chèn văn bản (vd biến `{tên khách}`) tại vị trí con trỏ. */
  insertText: (text: string) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  /** HTML hiện tại. Đổi từ bên ngoài (đổi mẫu, khôi phục) thì nội dung editor được nạp lại. */
  value: string;
  /** Gọi khi người dùng sửa; trả về HTML. Nội dung trống trả về chuỗi rỗng. */
  onChange: (html: string) => void;
  /** Nhãn truy cập của vùng soạn thảo. */
  ariaLabel: string;
  testId: string;
  /** Chiều cao tối thiểu vùng soạn thảo (px). */
  minHeight?: number;
  onFocus?: () => void;
}

const TEXT_COLORS = [
  { value: "#000000", label: "Đen" },
  { value: "#dc2626", label: "Đỏ" },
  { value: "#ea580c", label: "Cam" },
  { value: "#16a34a", label: "Xanh lá" },
  { value: "#0a66c2", label: "Xanh VNPT" },
  { value: "#7c3aed", label: "Tím" },
  { value: "#64748b", label: "Xám" },
];

const BACKGROUND_COLORS = [
  { value: "#fef08a", label: "Vàng nhạt" },
  { value: "#fecaca", label: "Đỏ nhạt" },
  { value: "#fed7aa", label: "Cam nhạt" },
  { value: "#bbf7d0", label: "Xanh lá nhạt" },
  { value: "#bfdbfe", label: "Xanh dương nhạt" },
  { value: "#e9d5ff", label: "Tím nhạt" },
  { value: "#e2e8f0", label: "Xám nhạt" },
];

type Popover = "color" | "highlight" | "link" | null;

function normalizeUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  if (/^(https?:\/\/|mailto:)/i.test(text)) return text;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return `mailto:${text}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text)) return `https://${text}`;
  return null;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
  testId,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      data-testid={testId}
      disabled={disabled}
      // Giữ vùng chọn của trình soạn thảo khi bấm nút.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-40 ${
        active ? "bg-blue-50 text-vnpt" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Swatches({
  colors,
  resetLabel,
  testPrefix,
  onPick,
  onReset,
  customLabel,
}: {
  colors: { value: string; label: string }[];
  resetLabel: string;
  testPrefix: string;
  onPick: (color: string) => void;
  onReset: () => void;
  customLabel: string;
}) {
  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={`${customLabel}: ${c.label}`}
            data-testid={`${testPrefix}-${c.value.slice(1)}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(c.value)}
            className="h-6 w-6 rounded-full border border-slate-300 hover:scale-110"
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Màu khác
          <input
            type="color"
            aria-label={`${customLabel}: màu tùy chọn`}
            onChange={(e) => onPick(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0"
          />
        </label>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          className="text-xs font-semibold text-vnpt hover:underline"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Trình soạn thảo định dạng cho nội dung email (Tiptap/ProseMirror): đậm,
 * nghiêng, gạch chân, màu chữ, tô nền, danh sách, liên kết, xóa định dạng.
 * Chỉ tạo các thẻ nằm trong danh sách cho phép của backend (p, br, b/strong,
 * i/em, u, span[style color/background-color], ul/ol/li, a); backend vẫn làm
 * sạch lại khi lưu và khi gửi.
 */
const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, ariaLabel, testId, minHeight = 180, onFocus },
  ref
) {
  const [popover, setPopover] = useState<Popover>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const lastHtml = useRef(value);
  const onChangeRef = useRef(onChange);
  const onFocusRef = useRef(onFocus);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
    onFocusRef.current = onFocus;
  });

  const editor = useEditor({
    immediatelyRender: false,
    // Cập nhật trạng thái nút (đậm/nghiêng...) theo vùng chọn.
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: false,
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      Color,
      BackgroundColor,
    ],
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        class:
          "px-3 py-2 text-sm leading-relaxed text-slate-800 focus:outline-none [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:text-vnpt [&_a]:underline",
        style: `min-height:${minHeight}px`,
      },
    },
    onUpdate({ editor: ed }) {
      const html = ed.isEmpty ? "" : ed.getHTML();
      lastHtml.current = html;
      onChangeRef.current(html);
    },
    onFocus() {
      onFocusRef.current?.();
    },
  });

  // Nội dung đổi từ bên ngoài (đổi nhóm, khôi phục mặc định, tải xong) thì nạp lại, không bắn onChange.
  useEffect(() => {
    if (!editor || value === lastHtml.current) return;
    editor.commands.setContent(value, { emitUpdate: false });
    lastHtml.current = value;
  }, [editor, value]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      focus: () => {
        editor?.commands.focus();
      },
    }),
    [editor]
  );

  // Đóng popover khi bấm ra ngoài.
  useEffect(() => {
    if (!popover) return;
    function handle(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setPopover(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [popover]);

  if (!editor) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
        style={{ minHeight }}
      >
        Đang tải trình soạn thảo...
      </div>
    );
  }

  const ed: Editor = editor;

  function openLinkPopover() {
    setLinkUrl((ed.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(null);
    setPopover(popover === "link" ? null : "link");
  }

  function applyLink() {
    if (!linkUrl.trim()) {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
      setPopover(null);
      return;
    }
    const href = normalizeUrl(linkUrl);
    if (!href) {
      setLinkError("Chỉ hỗ trợ liên kết http, https hoặc mailto (vd https://vnpt.vn).");
      return;
    }
    const chain = ed.chain().focus().extendMarkRange("link");
    if (ed.state.selection.empty && !ed.isActive("link")) {
      chain.insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setPopover(null);
  }

  return (
    <div
      ref={rootRef}
      data-testid={testId}
      className="rounded-lg border border-slate-200 bg-white focus-within:border-vnpt"
    >
      <div
        role="toolbar"
        aria-label="Định dạng nội dung"
        className="relative flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5"
      >
        <ToolbarButton label="Đậm" active={ed.isActive("bold")} onClick={() => ed.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Nghiêng"
          active={ed.isActive("italic")}
          onClick={() => ed.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch chân"
          active={ed.isActive("underline")}
          onClick={() => ed.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <div className="relative">
          <ToolbarButton
            label="Màu chữ"
            active={popover === "color"}
            onClick={() => setPopover(popover === "color" ? null : "color")}
          >
            <Palette className="h-4 w-4" style={{ color: (ed.getAttributes("textStyle").color as string) || undefined }} />
          </ToolbarButton>
          {popover === "color" && (
            <Swatches
              colors={TEXT_COLORS}
              customLabel="Màu chữ"
              testPrefix="text-color"
              resetLabel="Bỏ màu"
              onPick={(c) => {
                ed.chain().focus().setColor(c).run();
                setPopover(null);
              }}
              onReset={() => {
                ed.chain().focus().unsetColor().run();
                setPopover(null);
              }}
            />
          )}
        </div>
        <div className="relative">
          <ToolbarButton
            label="Tô nền"
            active={popover === "highlight"}
            onClick={() => setPopover(popover === "highlight" ? null : "highlight")}
          >
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          {popover === "highlight" && (
            <Swatches
              colors={BACKGROUND_COLORS}
              customLabel="Tô nền"
              testPrefix="bg-color"
              resetLabel="Bỏ tô nền"
              onPick={(c) => {
                ed.chain().focus().setBackgroundColor(c).run();
                setPopover(null);
              }}
              onReset={() => {
                ed.chain().focus().unsetBackgroundColor().run();
                setPopover(null);
              }}
            />
          )}
        </div>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          label="Danh sách chấm"
          active={ed.isActive("bulletList")}
          onClick={() => ed.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách số"
          active={ed.isActive("orderedList")}
          onClick={() => ed.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="relative">
          <ToolbarButton label="Chèn liên kết" active={ed.isActive("link") || popover === "link"} onClick={openLinkPopover}>
            <Link2 className="h-4 w-4" />
          </ToolbarButton>
          {popover === "link" && (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
              <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor={`${testId}-link-url`}>
                Địa chỉ liên kết
              </label>
              <input
                id={`${testId}-link-url`}
                autoFocus
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyLink();
                  } else if (e.key === "Escape") {
                    setPopover(null);
                  }
                }}
                placeholder="https://vnpt.vn"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-vnpt focus:outline-none"
              />
              {linkError && (
                <p role="alert" className="mt-1 text-xs text-rose-600">
                  {linkError}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPopover(null)}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={applyLink}
                  className="rounded-lg bg-vnpt px-3 py-1 text-xs font-semibold text-white hover:bg-[#0066a6]"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>
        <ToolbarButton
          label="Gỡ liên kết"
          disabled={!ed.isActive("link")}
          onClick={() => ed.chain().focus().extendMarkRange("link").unsetLink().run()}
        >
          <Unlink className="h-4 w-4" />
        </ToolbarButton>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton
          label="Xóa định dạng"
          onClick={() => ed.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Hoàn tác" disabled={!ed.can().undo()} onClick={() => ed.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Làm lại" disabled={!ed.can().redo()} onClick={() => ed.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={ed} />
    </div>
  );
});

export default RichTextEditor;
