"use client";

import { useLayoutEffect, useRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { groupDigits, normalizeMoneyDigits } from "@/lib/money";

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "inputMode"> {
  /** Chuỗi chỉ gồm chữ số (vd "5940000"); rỗng = chưa nhập. Gửi lên API bằng Number(value). */
  value: string;
  onChange: (digits: string) => void;
  /** Hiển thị đơn vị mờ bên phải ô nhập (vd "₫"). */
  suffix?: string;
}

/**
 * Ô nhập tiền: hiển thị dấu chấm ngăn cách hàng nghìn ngay khi gõ (5.940.000),
 * giá trị trả về (onChange) luôn là chuỗi chữ số thuần để gửi API dạng số nguyên.
 * Giữ nguyên vị trí con trỏ sau khi định dạng lại.
 */
export default function MoneyInput({
  value,
  onChange,
  suffix,
  className = "",
  ...rest
}: Readonly<MoneyInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaretDigits = useRef<number | null>(null);
  const display = groupDigits(normalizeMoneyDigits(value));

  // Đặt lại con trỏ theo số chữ số đứng trước nó (dấu chấm thêm/bớt không làm lệch vị trí).
  useLayoutEffect(() => {
    const el = inputRef.current;
    const digitsBefore = pendingCaretDigits.current;
    if (!el || digitsBefore === null) return;
    pendingCaretDigits.current = null;
    let seen = 0;
    let pos = 0;
    while (pos < display.length && seen < digitsBefore) {
      if (/\d/.test(display[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
  }, [display]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const caret = e.target.selectionStart ?? raw.length;
    pendingCaretDigits.current = raw.slice(0, caret).replace(/\D/g, "").length;
    onChange(normalizeMoneyDigits(raw));
  }

  return (
    <div className="relative">
      <input
        {...rest}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={display}
        onChange={handleChange}
        className={`${className} ${suffix ? "pr-8" : ""}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          {suffix}
        </span>
      )}
    </div>
  );
}
