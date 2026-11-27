import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { initDatabase, run } = await import("../../database/db.js");
const { ContractTemplateRegistryService } = await import("./contract-template-registry.service.js");

await initDatabase();

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "contract-tpl-"));
}

test("list: mẫu chưa có file thật -> available=false; mẫu có file -> available=true", async () => {
  const dir = makeTempDir();
  fs.writeFileSync(path.join(dir, "hoa-don-dien-tu.docx"), "fake docx content");
  const registry = new ContractTemplateRegistryService(dir);

  const list = await registry.list();
  const fiber = list.find((t) => t.key === "fiber_mau_05")!;
  const hoaDon = list.find((t) => t.key === "hoa_don_dien_tu")!;

  assert.equal(fiber.available, false);
  assert.equal(hoaDon.available, true);
});

test("rename: đổi tên hiển thị, list() trả về tên mới; tên gốc không đổi ở lần gọi khác (reset ở test sau)", async () => {
  await run("DELETE FROM contract_template_overrides WHERE key = 'fiber_mau_05'");
  const dir = makeTempDir();
  const registry = new ContractTemplateRegistryService(dir);

  const before = await registry.get("fiber_mau_05");
  assert.equal(before?.label, "Fiber (Mẫu 05)");

  const renamed = await registry.rename("fiber_mau_05", "Fiber Mẫu 05 - Bản mới");
  assert.equal(renamed.label, "Fiber Mẫu 05 - Bản mới");

  const after = await registry.get("fiber_mau_05");
  assert.equal(after?.label, "Fiber Mẫu 05 - Bản mới");

  await run("DELETE FROM contract_template_overrides WHERE key = 'fiber_mau_05'");
});

test("rename: tên rỗng bị từ chối, key không tồn tại bị từ chối", async () => {
  const dir = makeTempDir();
  const registry = new ContractTemplateRegistryService(dir);

  await assert.rejects(() => registry.rename("fiber_mau_05", "   "));
  await assert.rejects(() => registry.rename("khong_ton_tai", "Tên bất kỳ"));
});

test("saveFile: ghi file lên đúng đường dẫn, list() sau đó thấy available=true", async () => {
  const dir = makeTempDir();
  const registry = new ContractTemplateRegistryService(dir);

  let bhxh = await registry.get("bhxh");
  assert.equal(bhxh?.available, false);

  registry.saveFile("bhxh", Buffer.from("fake docx bytes"));

  bhxh = await registry.get("bhxh");
  assert.equal(bhxh?.available, true);
  assert.ok(fs.existsSync(path.join(dir, "bhxh.docx")));
});
