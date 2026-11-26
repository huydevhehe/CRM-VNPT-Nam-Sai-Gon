import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import { MemoRegistryService, MemoRegistryError } from "./memo-registry.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new MemoRegistryService();

async function resetTestData() {
  await run("DELETE FROM memo_registry");
}

test("register đăng ký số tờ trình nhập tay, trả về đúng năm hiện tại", async () => {
  await resetTestData();
  const entry = await service.register({ docNumber: "15", note: "Tờ trình xin chủ trương", registeredBy: "Khoa" });
  assert.equal(entry.docNumber, "15");
  assert.equal(entry.year, String(new Date().getFullYear()));
  assert.equal(entry.note, "Tờ trình xin chủ trương");
  assert.equal(entry.registeredBy, "Khoa");
});

test("register chặn số rỗng và số sai định dạng", async () => {
  await resetTestData();
  await assert.rejects(
    () => service.register({ docNumber: "", registeredBy: "Khoa" }),
    (err: unknown) => {
      assert.ok(err instanceof MemoRegistryError);
      assert.equal((err as MemoRegistryError).status, 400);
      return true;
    }
  );
  await assert.rejects(
    () => service.register({ docNumber: "số có nhiều hơn hai mươi ký tự liền nhau", registeredBy: "Khoa" }),
    (err: unknown) => {
      assert.ok(err instanceof MemoRegistryError);
      assert.equal((err as MemoRegistryError).status, 400);
      return true;
    }
  );
});

test("register chặn trùng số trong cùng năm", async () => {
  await resetTestData();
  await service.register({ docNumber: "20", registeredBy: "Khoa" });
  await assert.rejects(
    () => service.register({ docNumber: "20", registeredBy: "An" }),
    (err: unknown) => {
      assert.ok(err instanceof MemoRegistryError);
      assert.equal((err as MemoRegistryError).status, 409);
      return true;
    }
  );
});

test("list trả về theo đúng năm lọc, mới nhất trước", async () => {
  await resetTestData();
  await service.register({ docNumber: "1", registeredBy: "Khoa" });
  await service.register({ docNumber: "2", registeredBy: "Khoa" });

  const all = await service.list();
  assert.equal(all.length, 2);
  assert.equal(all[0].docNumber, "2");

  const otherYear = await service.list("2000");
  assert.equal(otherYear.length, 0);
});
