"use client";

import { useState } from "react";

// A text input with a suggestion list we draw and style ourselves — unlike
// a native <input list> datalist, whose popup is drawn by the OS/browser
// chrome and can't be recolored past `color-scheme`.
export default function SuggestInput({
  value,
  onChange,
  onSelect,
  options,
  placeholder,
  onBlur,
  onKeyDown,
  className,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  options: string[];
  placeholder?: string;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed ? options.filter((o) => o.toLowerCase().includes(trimmed)) : options;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a suggestion's onClick still fires before we hide the
          // list — a plain blur would close it first and swallow the click.
          window.setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-md border border-black/10 bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-[#1e2231]">
          {filtered.map((name) => (
            <li key={name}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(name);
                  onSelect?.(name);
                  setOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
