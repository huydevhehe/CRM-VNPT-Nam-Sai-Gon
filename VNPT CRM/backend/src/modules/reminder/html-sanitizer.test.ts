import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeEmailHtml, htmlToText, textToHtml, looksLikeHtml } from "./html-sanitizer.js";

test("giữ nguyên các thẻ định dạng cho phép", () => {
  const html =
    "<p>Xin <strong>chào</strong>, <b>b</b> <i>i</i> <em>e</em> <u>u</u><br>dòng mới</p>" +
    "<ul><li>a</li></ul><ol><li>b</li></ol>";
  assert.equal(sanitizeEmailHtml(html), html);
});

test("loại script/style/iframe cùng nội dung, kể cả khi viết hoa hoặc không đóng", () => {
  assert.equal(sanitizeEmailHtml("<p>a</p><SCRIPT>alert(1)</SCRIPT><p>b</p>"), "<p>a</p><p>b</p>");
  assert.equal(sanitizeEmailHtml("<p>a</p><script>alert(1)"), "<p>a</p>");
  assert.equal(sanitizeEmailHtml('<style>p{color:red}</style><iframe src="//x"></iframe>ok'), "ok");
  // Thẻ lồng để lách bộ lọc: xoá lớp trong rồi phần còn lại ghép thành script thì bị xoá tiếp.
  assert.equal(sanitizeEmailHtml("<scr<script></script>ipt>alert(1)</script>x"), "");
  assert.equal(sanitizeEmailHtml("<scr<script>ipt>alert(1)</script>"), "&lt;scr");
});

test("loại thuộc tính sự kiện (onerror, onclick...) và thẻ lạ nhưng giữ chữ bên trong", () => {
  assert.equal(sanitizeEmailHtml('<img src=x onerror="alert(1)">chữ'), "chữ");
  assert.equal(sanitizeEmailHtml('<p onclick="x()" class="a" id="b">chào</p>'), "<p>chào</p>");
  assert.equal(sanitizeEmailHtml('<div style="x"><h1>tiêu đề</h1></div>'), "tiêu đề");
  assert.equal(sanitizeEmailHtml('<b onmouseover=alert(1)>đậm</b>'), "<b>đậm</b>");
});

test("liên kết: chỉ http/https/mailto, thêm rel noopener; javascript:/data: bị bỏ href", () => {
  assert.equal(
    sanitizeEmailHtml('<a href="https://vnpt.vn/a?x=1&y=2" onclick="x()">vnpt</a>'),
    '<a href="https://vnpt.vn/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">vnpt</a>'
  );
  assert.equal(sanitizeEmailHtml('<a href="mailto:a@b.vn">m</a>'), '<a href="mailto:a@b.vn" target="_blank" rel="noopener noreferrer">m</a>');
  for (const bad of [
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "&#106;avascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "//evil.com",
    "/relative",
  ]) {
    const out = sanitizeEmailHtml(`<a href="${bad}">x</a>`);
    assert.equal(out, "<a>x</a>", `href xấu phải bị bỏ: ${bad}`);
  }
});

test("style của span: chỉ color/background-color với giá trị màu an toàn", () => {
  assert.equal(sanitizeEmailHtml('<span style="color:#ff0000">a</span>'), '<span style="color: #ff0000">a</span>');
  assert.equal(
    sanitizeEmailHtml('<span style="color: rgb(1, 2, 3); background-color: rgba(255,255,0,0.5)">a</span>'),
    '<span style="color: rgb(1, 2, 3); background-color: rgba(255,255,0,0.5)">a</span>'
  );
  assert.equal(sanitizeEmailHtml('<span style="color:red;position:fixed;top:0">a</span>'), '<span style="color: red">a</span>');
  assert.equal(sanitizeEmailHtml('<span style="background-color:url(javascript:x)">a</span>'), "<span>a</span>");
  assert.equal(sanitizeEmailHtml('<span style="color:expression(alert(1))">a</span>'), "<span>a</span>");
  assert.equal(sanitizeEmailHtml('<span style="color:red;;background:blue">a</span>'), '<span style="color: red">a</span>');
  assert.equal(sanitizeEmailHtml('<p style="color:red">a</p>'), "<p>a</p>");
});

test("thẻ không cân bằng được đóng/bỏ cho hợp lệ; dấu < lẻ được escape", () => {
  assert.equal(sanitizeEmailHtml("<p><b>a</p>b</b>"), "<p><b>a</b></p>b");
  assert.equal(sanitizeEmailHtml("a < b > c"), "a &lt; b &gt; c");
  assert.equal(sanitizeEmailHtml("</p></b>x"), "x");
  assert.equal(sanitizeEmailHtml("<p>a<br/>b</p>"), "<p>a<br>b</p>");
});

test("loại chú thích, CDATA, khai báo và null byte", () => {
  assert.equal(sanitizeEmailHtml("a<!-- <script>x</script> -->b"), "ab");
  assert.equal(sanitizeEmailHtml("a<![CDATA[x]]>b"), "ab");
  assert.equal(sanitizeEmailHtml("<scri\u0000pt>alert(1)</script>"), "");
});

test("không phình to với đầu vào lồng sâu và nhiều thẻ mở", () => {
  const deep = "<b>".repeat(5000) + "x";
  const out = sanitizeEmailHtml(deep);
  assert.ok(out.length < 1000);
  const started = Date.now();
  sanitizeEmailHtml("<a ".repeat(3000) + "x");
  sanitizeEmailHtml("<script ".repeat(3000));
  assert.ok(Date.now() - started < 2000, "phải chạy nhanh với đầu vào xấu");
});

test("htmlToText: đoạn, xuống dòng, danh sách, liên kết, entity", () => {
  assert.equal(htmlToText("<p>a &amp; b<br>c</p><p>d &lt;x&gt;</p>"), "a & b\nc\n\nd <x>");
  assert.equal(htmlToText("<ul><li><p>một</p></li><li>hai</li></ul>"), "- một\n- hai");
  assert.equal(htmlToText("<ol><li>a</li><li>b</li></ol>"), "1. a\n2. b");
  assert.equal(htmlToText('<p><a href="https://vnpt.vn" target="_blank">VNPT</a></p>'), "VNPT (https://vnpt.vn)");
  assert.equal(htmlToText('<p><a href="https://vnpt.vn">https://vnpt.vn</a></p>'), "https://vnpt.vn");
  assert.equal(htmlToText('<a href="mailto:a@b.vn">Liên hệ</a>'), "Liên hệ (a@b.vn)");
  assert.equal(htmlToText("<p></p><p></p><p>x</p>"), "x");
});

test("textToHtml/looksLikeHtml: văn bản thuần → đoạn + <br>, escape; nhận diện HTML", () => {
  assert.equal(textToHtml("a\nb\n\nc <b>"), "<p>a<br>b</p><p>c &lt;b&gt;</p>");
  assert.equal(textToHtml("  \n "), "");
  assert.equal(looksLikeHtml("a < b và {biến}"), false);
  assert.equal(looksLikeHtml("<p>a</p>"), true);
  assert.equal(looksLikeHtml("xin <b>chào"), true);
});
