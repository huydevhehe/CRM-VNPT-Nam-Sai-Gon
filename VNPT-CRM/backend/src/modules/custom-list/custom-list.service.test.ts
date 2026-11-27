import test from "node:test";
import assert from "node:assert/strict";
import { initDatabase, run } from "../../database/db.js";
import { applySchemaExtensions } from "../../database/schema-extensions.js";
import { CustomListService, CustomListError } from "./custom-list.service.js";

await initDatabase();
await applySchemaExtensions();

const service = new CustomListService();

async function resetTestData() {
  await run("DELETE FROM custom_list_items");
  await run("DELETE FROM custom_lists");
}

test("createList tạo danh mục mới, chặn trùng tên", async () => {
  await resetTestData();
  const list = await service.createList("Kênh bán");
  assert.equal(list.name, "Kênh bán");
  assert.deepEqual(list.items, []);

  await assert.rejects(
    () => service.createList("Kênh bán"),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 409);
      return true;
    }
  );
});

test("createList chặn tên rỗng", async () => {
  await resetTestData();
  await assert.rejects(
    () => service.createList("   "),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 400);
      return true;
    }
  );
});

test("addItem thêm giá trị vào danh mục, chặn trùng, giữ thứ tự tăng dần", async () => {
  await resetTestData();
  const list = await service.createList("Kênh bán");

  const first = await service.addItem(list.id, "Online");
  const second = await service.addItem(list.id, "Đại lý");
  assert.equal(first.sortOrder, 1);
  assert.equal(second.sortOrder, 2);
  assert.equal(first.active, true);

  await assert.rejects(
    () => service.addItem(list.id, "Online"),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 409);
      return true;
    }
  );

  await assert.rejects(
    () => service.addItem("CLIST-not-found", "X"),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 404);
      return true;
    }
  );
});

test("addItem/updateItem: price tùy chọn — nhập số hợp lệ, chặn số âm, có thể xóa về null", async () => {
  await resetTestData();
  const list = await service.createList("Gói dịch vụ Internet/Fiber");

  const withPrice = await service.addItem(list.id, "Fiber Xtra 2", 500000);
  assert.equal(withPrice.price, 500000);

  const withoutPrice = await service.addItem(list.id, "Fiber Xtra 3");
  assert.equal(withoutPrice.price, null);

  await assert.rejects(
    () => service.addItem(list.id, "Fiber Xtra 4", -1000),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 400);
      return true;
    }
  );

  const updated = await service.updateItem(withoutPrice.id, { price: 700000 });
  assert.equal(updated.price, 700000);

  const cleared = await service.updateItem(updated.id, { price: null });
  assert.equal(cleared.price, null);
});

test("updateItem sửa giá trị hoặc ẩn/hiện", async () => {
  await resetTestData();
  const list = await service.createList("Kênh bán");
  const item = await service.addItem(list.id, "Online");

  const renamed = await service.updateItem(item.id, { value: "Online mới" });
  assert.equal(renamed.value, "Online mới");

  const hidden = await service.updateItem(item.id, { active: false });
  assert.equal(hidden.active, false);

  await assert.rejects(
    () => service.updateItem(item.id, { active: "yes" as unknown as boolean }),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 400);
      return true;
    }
  );
});

test("removeItem xóa hẳn 1 giá trị", async () => {
  await resetTestData();
  const list = await service.createList("Kênh bán");
  const item = await service.addItem(list.id, "Online");

  await service.removeItem(item.id);
  const after = await service.getList(list.id);
  assert.equal(after?.items.length, 0);

  await assert.rejects(
    () => service.removeItem(item.id),
    (err: unknown) => {
      assert.ok(err instanceof CustomListError);
      assert.equal((err as CustomListError).status, 404);
      return true;
    }
  );
});

test("removeList xóa cả danh mục lẫn các giá trị bên trong", async () => {
  await resetTestData();
  const list = await service.createList("Kênh bán");
  await service.addItem(list.id, "Online");

  await service.removeList(list.id);
  assert.equal(await service.getList(list.id), null);

  const all = await service.listAll();
  assert.equal(all.length, 0);
});

test("listAll trả về danh mục kèm theo các giá trị của nó", async () => {
  await resetTestData();
  const a = await service.createList("Kênh bán");
  const b = await service.createList("Lĩnh vực kinh doanh");
  await service.addItem(a.id, "Online");
  await service.addItem(b.id, "Giáo dục");

  const all = await service.listAll();
  assert.equal(all.length, 2);
  const kenhBan = all.find((l) => l.id === a.id);
  assert.equal(kenhBan?.items.length, 1);
  assert.equal(kenhBan?.items[0].value, "Online");
});
