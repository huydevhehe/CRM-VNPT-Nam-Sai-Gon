/**
 * Làm sạch HTML cho nội dung email nhắc hạn (allowlist, không dùng thư viện ngoài).
 *
 * Chỉ giữ: p, br, b, strong, i, em, u, span[style: color/background-color],
 * ul, ol, li, a[href http/https/mailto]. Mọi thẻ/thuộc tính khác bị loại bỏ
 * (thẻ nguy hiểm như script/style/iframe bị loại cùng nội dung); thẻ không
 * cân bằng được tự đóng/bỏ để HTML đầu ra luôn hợp lệ.
 */

const ALLOWED_TAGS = new Set(["p", "br", "b", "strong", "i", "em", "u", "span", "ul", "ol", "li", "a"]);
const VOID_TAGS = new Set(["br"]);
/** Thẻ mà cả nội dung bên trong cũng bị bỏ (không chỉ bỏ thẻ). */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "template",
  "svg",
  "math",
  "head",
  "title",
  "textarea",
  "select",
  "button",
  "form",
  "frame",
  "frameset",
  "applet",
]);

const MAX_DEPTH = 40;

const TAG_AT_POSITION = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/;
const ATTRIBUTE_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+|1\.0+)\s*)?\)|[a-z]{3,24})$/i;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s<>"']+$/i;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseAttributes(raw: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of raw.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1].toLowerCase();
    if (attrs.has(name)) continue;
    attrs.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/** Giữ lại đúng `color` và `background-color` với giá trị màu an toàn; trả về chuỗi style mới (có thể rỗng). */
function sanitizeStyle(raw: string): string {
  const kept: string[] = [];
  for (const declaration of decodeBasicEntities(raw).split(";")) {
    const index = declaration.indexOf(":");
    if (index < 0) continue;
    const property = declaration.slice(0, index).trim().toLowerCase();
    const value = declaration.slice(index + 1).trim();
    if ((property === "color" || property === "background-color") && SAFE_COLOR.test(value)) {
      kept.push(`${property}: ${value}`);
    }
  }
  return kept.join("; ");
}

function sanitizeHref(raw: string): string | null {
  // Bỏ ký tự điều khiển/khoảng trắng chèn giữa chữ (vd "java\tscript:") trước khi kiểm tra.
  const cleaned = decodeBasicEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, "");
  return SAFE_HREF.test(cleaned) ? cleaned : null;
}

function buildOpenTag(tag: string, attrs: Map<string, string>): string {
  if (tag === "span") {
    const style = sanitizeStyle(attrs.get("style") ?? "");
    return style ? `<span style="${escapeAttribute(style)}">` : "<span>";
  }
  if (tag === "a") {
    const href = sanitizeHref(attrs.get("href") ?? "");
    return href ? `<a href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer">` : "<a>";
  }
  return `<${tag}>`;
}

/** Bỏ các khối nguy hiểm (kèm nội dung) và chú thích trước khi quét thẻ. */
function dropDangerousBlocks(html: string): string {
  let result = html;
  // Lặp đến khi ổn định: xoá khối bên trong có thể ghép phần còn lại thành thẻ mới (vd `<scr<script></script>ipt>`).
  for (let pass = 0; pass < 5; pass += 1) {
    const before = result;
    result = result.replace(/<!--[\s\S]*?(?:-->|$)/g, "").replace(/<![^>]*>?/g, "").replace(/<\?[\s\S]*?(?:\?>|>|$)/g, "");
    for (const tag of DROP_WITH_CONTENT) {
      const closed = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, "gi");
      const unclosed = new RegExp(`<${tag}\\b[\\s\\S]*$`, "gi");
      result = result.replace(closed, "").replace(unclosed, "");
    }
    if (result === before) break;
  }
  return result;
}

export function sanitizeEmailHtml(input: string): string {
  const html = dropDangerousBlocks(input.replace(/\u0000/g, ""));
  const stack: string[] = [];
  let output = "";
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      output += escapeText(html.slice(i));
      break;
    }
    output += escapeText(html.slice(i, lt));

    const match = TAG_AT_POSITION.exec(html.slice(lt));
    if (!match) {
      output += "&lt;";
      i = lt + 1;
      continue;
    }
    i = lt + match[0].length;

    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) continue; // bỏ thẻ, giữ chữ bên trong

    if (closing) {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue; // thẻ đóng thừa
      while (stack.length > at) {
        output += `</${stack.pop()}>`;
      }
      continue;
    }

    if (VOID_TAGS.has(tag)) {
      output += `<${tag}>`;
      continue;
    }
    if (stack.length >= MAX_DEPTH) continue;
    output += buildOpenTag(tag, parseAttributes(match[3]));
    stack.push(tag);
  }

  while (stack.length > 0) {
    output += `</${stack.pop()}>`;
  }
  return output;
}

/** Nội dung có chứa thẻ HTML thật không (dùng phân biệt mẫu cũ dạng văn bản thuần). */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s[^<>]*)?\/?>/.test(value);
}

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Văn bản thuần (mẫu cũ) → HTML: dòng trống tách đoạn, xuống dòng đơn → `<br>`. */
export function textToHtml(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";
  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtmlText(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d{1,7});/g, (_m, code: string) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_m, code: string) => {
      const point = parseInt(code, 16);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

/** Chỉ bỏ thẻ, giữ chữ (không đổi entity) — dùng để so khớp biến `{...}` bị chen thẻ định dạng. */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/** HTML đã làm sạch → bản văn bản thuần cho phần `text/plain` của email. */
export function htmlToText(html: string): string {
  const listStack: Array<{ ordered: boolean; counter: number }> = [];
  let listItemDepth = 0;
  const linkStack: string[] = [];
  const linkTextStart: number[] = [];
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const match = TAG_AT_POSITION.exec(html.slice(lt));
    if (!match) {
      out += "<";
      i = lt + 1;
      continue;
    }
    i = lt + match[0].length;
    const closing = match[1] === "/";
    const tag = match[2].toLowerCase();
    if (tag === "br") {
      out += "\n";
    } else if (tag === "p" || tag === "div") {
      if (closing) out += listItemDepth > 0 ? "\n" : "\n\n";
      else if (listItemDepth === 0 && out && !out.endsWith("\n")) out += "\n";
    } else if (tag === "ul" || tag === "ol") {
      if (closing) {
        listStack.pop();
        out += out.endsWith("\n") ? "" : "\n";
      } else {
        listStack.push({ ordered: tag === "ol", counter: 0 });
        if (out && !out.endsWith("\n")) out += "\n";
      }
    } else if (tag === "li") {
      if (closing) {
        listItemDepth = Math.max(0, listItemDepth - 1);
        out += out.endsWith("\n") ? "" : "\n";
      } else {
        listItemDepth += 1;
        const list = listStack[listStack.length - 1];
        if (list) list.counter += 1;
        out += list?.ordered ? `${list.counter}. ` : "- ";
      }
    } else if (tag === "a" && !closing) {
      const hrefMatch = /href="([^"]*)"/.exec(match[3]);
      linkStack.push(hrefMatch ? decodeEntities(hrefMatch[1]) : "");
      linkTextStart.push(out.length);
    } else if (tag === "a" && closing) {
      const href = linkStack.pop() ?? "";
      const start = linkTextStart.pop() ?? out.length;
      const label = out.slice(start).trim();
      if (href && !href.startsWith("mailto:") && label !== href) out += ` (${href})`;
      else if (href.startsWith("mailto:") && label !== href.slice(7)) out += ` (${href.slice(7)})`;
    }
  }
  return decodeEntities(out)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
