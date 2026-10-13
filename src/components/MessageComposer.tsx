"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Bold, Italic, Strikethrough, Code, Link2, Smile, Braces,
  Paperclip, Image as ImageIcon, X, List, ListOrdered, Quote, ChevronDown
} from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load emoji picker to avoid SSR issues
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface MessageComposerProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  onImageAttach?: (file: File) => void;
  attachedImage?: File | null;
  onRemoveImage?: () => void;
}

type FormatAction = "bold" | "italic" | "strikethrough" | "monospace" | "code" | "link" | "bullet" | "numbered" | "quote";

const FORMAT_MAP: Record<FormatAction, { prefix: string; suffix: string; block?: boolean }> = {
  bold: { prefix: "*", suffix: "*" },
  italic: { prefix: "_", suffix: "_" },
  strikethrough: { prefix: "~", suffix: "~" },
  monospace: { prefix: "```", suffix: "```" },
  code: { prefix: "`", suffix: "`" },
  link: { prefix: "", suffix: "" },
  bullet: { prefix: "- ", suffix: "", block: true },
  numbered: { prefix: "1. ", suffix: "", block: true },
  quote: { prefix: "> ", suffix: "", block: true },
};

export default function MessageComposer({
  value,
  onChange,
  variables,
  onImageAttach,
  attachedImage,
  onRemoveImage,
}: MessageComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showSpintaxHelper, setShowSpintaxHelper] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".emoji-dropdown") && !target.closest(".emoji-trigger")) {
        setShowEmojiPicker(false);
      }
      if (!target.closest(".var-dropdown") && !target.closest(".var-trigger")) {
        setShowVariables(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Preview attached image
  useEffect(() => {
    if (attachedImage) {
      const url = URL.createObjectURL(attachedImage);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreview(null);
  }, [attachedImage]);

  const insertAtCursor = useCallback((text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newValue = before + text + after;
    onChange(newValue);
    // Restore cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + text.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [value, onChange]);

  const wrapSelection = useCallback((action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);
    const { prefix, suffix, block } = FORMAT_MAP[action];

    if (action === "link") {
      const url = selectedText.startsWith("http") ? selectedText : "https://";
      const linkText = selectedText.startsWith("http") ? "link" : selectedText || "link";
      insertAtCursor(url);
      return;
    }

    if (block) {
      // For block-level formatting, add at the start of each line
      const lines = selectedText.split("\n");
      const formatted = lines.map((line, i) => {
        if (action === "numbered") return `${i + 1}. ${line}`;
        return `${prefix}${line}`;
      }).join("\n");
      const before = value.slice(0, start);
      const after = value.slice(end);
      onChange(before + formatted + after);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + formatted.length);
      });
      return;
    }

    if (selectedText) {
      const formatted = `${prefix}${selectedText}${suffix}`;
      const before = value.slice(0, start);
      const after = value.slice(end);
      onChange(before + formatted + after);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + formatted.length);
      });
    } else {
      const placeholder = action.charAt(0).toUpperCase() + action.slice(1) + " text";
      insertAtCursor(`${prefix}${placeholder}${suffix}`);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
      });
    }
  }, [value, onChange, insertAtCursor]);

  const handleEmojiClick = useCallback((emojiData: any) => {
    insertAtCursor(emojiData.emoji);
    setShowEmojiPicker(false);
  }, [insertAtCursor]);

  const handleVariableInsert = useCallback((varName: string) => {
    insertAtCursor(`{{${varName}}}`);
    setShowVariables(false);
  }, [insertAtCursor]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageAttach) {
      onImageAttach(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const toolbarButtons: { action: FormatAction; icon: any; label: string; shortcut?: string }[] = [
    { action: "bold", icon: Bold, label: "Bold", shortcut: "*text*" },
    { action: "italic", icon: Italic, label: "Italic", shortcut: "_text_" },
    { action: "strikethrough", icon: Strikethrough, label: "Strikethrough", shortcut: "~text~" },
    { action: "monospace", icon: Code, label: "Monospace", shortcut: "```text```" },
    { action: "link", icon: Link2, label: "Link" },
  ];

  const blockButtons: { action: FormatAction; icon: any; label: string }[] = [
    { action: "bullet", icon: List, label: "Bulleted List" },
    { action: "numbered", icon: ListOrdered, label: "Numbered List" },
    { action: "quote", icon: Quote, label: "Block Quote" },
  ];

  return (
    <div className="border border-border/50 rounded-2xl overflow-hidden bg-background/50">
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-[200px] bg-transparent p-5 text-foreground outline-none resize-none text-base leading-relaxed"
          placeholder="Compose your outreach message... Use {{ to trigger variables selector."
          onKeyDown={(e) => {
            // Keyboard shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === "b") { e.preventDefault(); wrapSelection("bold"); }
            if ((e.ctrlKey || e.metaKey) && e.key === "i") { e.preventDefault(); wrapSelection("italic"); }
          }}
        />

        {/* Attached Image Preview */}
        {imagePreview && (
          <div className="mx-5 mb-3 relative inline-block">
            <img src={imagePreview} alt="Attached" className="h-24 rounded-lg border border-border/50 object-cover" />
            <button
              onClick={onRemoveImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Formatting Toolbar */}
      <div className="border-t border-border/30 px-3 py-2 flex items-center gap-1 flex-wrap">
        {/* Inline formatting */}
        {toolbarButtons.map(({ action, icon: Icon, label, shortcut }) => (
          <button
            key={action}
            type="button"
            onClick={() => wrapSelection(action)}
            title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="w-px h-5 bg-border/50 mx-1" />

        {/* Block formatting */}
        {blockButtons.map(({ action, icon: Icon, label }) => (
          <button
            key={action}
            type="button"
            onClick={() => wrapSelection(action)}
            title={label}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        <div className="w-px h-5 bg-border/50 mx-1" />

        {/* Emoji Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowVariables(false); }}
            title="Emoji"
            className="emoji-trigger p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <Smile className="w-4 h-4" />
          </button>
          {showEmojiPicker && (
            <div className="emoji-dropdown absolute bottom-full left-0 mb-2 z-50 shadow-2xl rounded-xl overflow-hidden">
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                width={320}
                height={400}
                searchPlaceholder="Search emoji..."
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}
        </div>

        {/* Variables Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => { setShowVariables(!showVariables); setShowEmojiPicker(false); }}
            title="Insert Variable"
            className="var-trigger p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex items-center gap-1"
          >
            <Braces className="w-4 h-4" />
          </button>
          {showVariables && variables.length > 0 && (
            <div className="var-dropdown absolute bottom-full left-0 mb-2 z-50 bg-background border border-border/50 rounded-xl shadow-2xl p-2 min-w-[200px] max-h-[240px] overflow-y-auto">
              <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">Insert Variable</p>
              {variables.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleVariableInsert(v)}
                  className="w-full text-left px-3 py-2 text-sm font-mono rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attachment */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach Image"
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Right side — Spintax helper */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Spintax:</span>
          <button
            type="button"
            onClick={() => insertAtCursor("{Option A|Option B}")}
            className="text-xs font-mono bg-secondary/50 hover:bg-secondary border border-border/50 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
          >
            {"{A|B}"}
          </button>
        </div>
      </div>

      {/* Variables Section */}
      <div className="border-t border-border/30 px-4 py-3">
        {variables.length > 0 ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="var-trigger flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
              >
                <Braces className="w-4 h-4 text-primary" />
                Variables
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showVariables ? "rotate-180" : ""}`} />
              </button>
              <span className="text-xs text-muted-foreground">{variables.length} available from CSV</span>
            </div>

            {/* Always-visible quick chips */}
            <div className="flex gap-1.5 flex-wrap">
              {variables.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertAtCursor(`{{${v}}}`)}
                  className="text-xs font-mono bg-secondary/50 hover:bg-primary/10 hover:text-primary border border-border/50 px-2.5 py-1.5 rounded-lg text-muted-foreground transition-colors cursor-pointer"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            {/* Expanded dropdown with descriptions */}
            {showVariables && (
              <div className="var-dropdown bg-secondary/20 border border-border/30 rounded-xl p-3 space-y-1">
                <p className="text-xs text-muted-foreground mb-2">Click a variable to insert it at cursor position:</p>
                {variables.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { handleVariableInsert(v); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-primary/10 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{`{{${v}}}`}</span>
                      <span className="text-sm text-muted-foreground group-hover:text-foreground capitalize">{v.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">Click to insert</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Braces className="w-4 h-4" />
            <span>Upload a CSV in Step 1 to unlock personalization variables like <code className="bg-secondary/50 px-1 rounded">{`{{name}}`}</code>, <code className="bg-secondary/50 px-1 rounded">{`{{company}}`}</code></span>
          </div>
        )}
      </div>
    </div>
  );
}
