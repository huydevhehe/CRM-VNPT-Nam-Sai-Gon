import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { applySchemaExtensions } = await import("../../database/schema-extensions.js");
const { RANDOM_STAFF_TOKEN } = await import("../../constants/org.js");
const { LeadService, LeadServiceError } = await import("./lead.service.js");

await initDatabase();

const ONLINE_SOURCE_ID = (
  await query<{ id: string }>("SELECT id FROM channel_sources WHERE kind = 'online' ORDER BY sort_order LIMIT 1")
)[0].id;

test("create accepts new lead group names", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const result = await service.create({
    customerName: `KH Lead Test ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead bán chéo DV",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
    expectedValue: 1000000,
  });

  assert.equal(result.group, "Lead bán chéo DV");
});

test("create rejects old lead group names", async () => {
  const service = new LeadService();
  const suffix = Date.now();

  await assert.rejects(
    async () => {
      await service.create({
        customerName: `KH Lead Old ${suffix}`,
        phone: `090${String(suffix).slice(-7)}`,
        group: "Khách hàng mới",
        channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
        staffName: "Nguyễn Thị Tình",
        expectedValue: 1000000,
      });
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Nhóm cơ hội không hợp lệ");
      return true;
    }
  );
});

test("lead_group_rename_v1 migrates existing rows", async () => {
  const suffix = Date.now();
  const testLeadId = `LEAD-MIGRATE-${suffix}`;

  await run(
    `INSERT INTO leads (id, customer_name, phone, group_name, channel, staff_name, status, expected_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [testLeadId, `KH Test Migrate ${suffix}`, `091${String(suffix).slice(-7)}`, "Gia hạn dịch vụ", "Online", "Nguyễn Thị Tình", "Mới tiếp nhận", 0]
  );

  await run("DELETE FROM schema_migrations_state WHERE key = 'lead_group_rename_v1'");

  await applySchemaExtensions();

  const rows = await query<{ group_name: string }>("SELECT group_name FROM leads WHERE id = ?", [testLeadId]);
  assert.equal(rows[0]?.group_name, "Lead gia hạn");
});

test("create without expectedValue stores 0", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Không Giá Trị ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  assert.equal(lead.expectedValue, 0);
});

test("create with RANDOM_STAFF_TOKEN picks an active AM", async () => {
  const suffix = Date.now();
  const amName1 = `AM Active A ${suffix}`;
  const amName2 = `AM Active B ${suffix}`;

  await run(
    "INSERT INTO staff (id, name, code, role, status) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
    [
      `STF-ACT-1-${suffix}`, amName1, `CODE-ACT-1-${suffix}`, "AM", "Đang hoạt động",
      `STF-ACT-2-${suffix}`, amName2, `CODE-ACT-2-${suffix}`, "AM", "Đang hoạt động",
    ]
  );

  const service = new LeadService({ random: () => 0 });
  const lead = await service.create({
    customerName: `KH Random Test ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: RANDOM_STAFF_TOKEN,
  });

  const activeAmRows = await query<{ name: string }>(
    "SELECT name FROM staff WHERE status = 'Đang hoạt động' AND role IN ('AM', 'AM Bán chăm') ORDER BY name"
  );
  assert.equal(lead.staffName, activeAmRows[0].name);
});

test("create with RANDOM_STAFF_TOKEN never picks inactive staff (deterministic, every index)", async () => {
  const suffix = Date.now();
  const inactiveStaffName = `AM Inactive ${suffix}`;

  await run(
    "INSERT INTO staff (id, name, code, role, status) VALUES (?, ?, ?, ?, ?)",
    [`STF-INACT-${suffix}`, inactiveStaffName, `CODE-INACT-${suffix}`, "AM", "Nghỉ việc"]
  );

  // Lấy đúng tập AM đang hoạt động mà service thực sự truy vấn (cùng điều kiện
  // WHERE/ORDER BY), để biết chính xác kích thước pool N — rồi ép random() đi
  // qua MỌI chỉ số 0..N-1. Nếu service lỡ không lọc status (bug), nhân viên
  // "Nghỉ việc" sẽ lọt vào pool và một trong các chỉ số sẽ trả về tên đó —
  // test này bắt được lỗi đó chắc chắn, không phụ thuộc may rủi của Math.random thật.
  const activeAmRows = await query<{ name: string }>(
    `SELECT name FROM staff WHERE status = 'Đang hoạt động' AND role IN ('AM', 'AM Bán chăm') ORDER BY name`
  );
  const poolSize = activeAmRows.length;
  assert.ok(poolSize > 0, "Cần có ít nhất 1 AM đang hoạt động để test có ý nghĩa");
  assert.ok(
    !activeAmRows.some((r) => r.name === inactiveStaffName),
    "Nhân viên vừa tạo phải là 'Nghỉ việc', không được xuất hiện trong pool AM đang hoạt động"
  );

  for (let index = 0; index < poolSize; index += 1) {
    // random() trả về giá trị sao cho Math.floor(random() * poolSize) === index.
    const service = new LeadService({ random: () => index / poolSize });
    const lead = await service.create({
      customerName: `KH Inactive Test ${suffix}-${index}`,
      phone: `09${String(suffix).slice(-7)}${index}`,
      group: "Lead KH mới",
      channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
      staffName: RANDOM_STAFF_TOKEN,
    });

    assert.notEqual(lead.staffName, inactiveStaffName, `Chỉ số ${index}/${poolSize} không được chọn nhân viên nghỉ việc`);
    assert.ok(
      activeAmRows.some((r) => r.name === lead.staffName),
      `Chỉ số ${index}/${poolSize} phải chọn đúng tên trong pool AM đang hoạt động, nhận được "${lead.staffName}"`
    );
  }
});

test("create rejects unknown staffName", async () => {
  const service = new LeadService();
  const suffix = Date.now();

  await assert.rejects(
    async () => {
      await service.create({
        customerName: `KH Unknown Staff ${suffix}`,
        phone: `090${String(suffix).slice(-7)}`,
        group: "Lead KH mới",
        channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
        staffName: "Tên Nhân Viên Hoàn Toàn Không Tồn Tại 999",
      });
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Nhân viên không tồn tại");
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("updateNote saves trimmed note", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Note Test ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  const updated = await service.updateNote(lead.id, "   Ghi chú khách hàng quan tâm gói Fiber   ");
  assert.equal(updated.note, "Ghi chú khách hàng quan tâm gói Fiber");
});

test("updateNote with empty string clears note", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Note Empty ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  await service.updateNote(lead.id, "Ghi chú ban đầu");
  const cleared = await service.updateNote(lead.id, "   ");
  assert.equal(cleared.note, null);
});

test("updateNote rejects 1001 chars", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Note Long ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  const longNote = "a".repeat(1001);
  await assert.rejects(
    async () => {
      await service.updateNote(lead.id, longNote);
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Ghi chú tối đa 1000 ký tự");
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("updateNote 404 on unknown id", async () => {
  const service = new LeadService();
  await assert.rejects(
    async () => {
      await service.updateNote("UNKNOWN-LEAD-ID-999", "Một ghi chú");
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Không tìm thấy Lead");
      assert.equal(err.status, 404);
      return true;
    }
  );
});

test("remove deletes lead with no contract", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Xóa Lead ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  await service.remove(lead.id, { isAdmin: true, name: "Admin Test" });

  const rows = await query("SELECT id FROM leads WHERE id = ?", [lead.id]);
  assert.equal(rows.length, 0);
});

test("remove 404 on unknown id", async () => {
  const service = new LeadService();
  await assert.rejects(
    async () => {
      await service.remove("UNKNOWN-LEAD-ID-999", { isAdmin: true, name: "Admin Test" });
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Không tìm thấy Lead");
      assert.equal(err.status, 404);
      return true;
    }
  );
});

test("remove 409 when lead already used to create a contract", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Lead Có Đơn ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  await run(
    `INSERT INTO contracts (id, transaction_code, customer_name, subscriber_codes, channel, lead_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [`CTR-TEST-${suffix}`, `GD-TEST-${suffix}`, lead.customerName, "TB-001", "Online", lead.id]
  );

  await assert.rejects(
    async () => {
      await service.remove(lead.id, { isAdmin: true, name: "Admin Test" });
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.status, 409);
      assert.match(err.message, /đơn hàng/);
      return true;
    }
  );

  const stillThere = await query("SELECT id FROM leads WHERE id = ?", [lead.id]);
  assert.equal(stillThere.length, 1);
});

test("create: email không bắt buộc, để trống vẫn tạo được", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Lead Email Trống ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  assert.equal(lead.email, null);
});

test("create: lưu đúng email hợp lệ", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Lead Email Hợp Lệ ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    email: "khach@example.com",
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  assert.equal(lead.email, "khach@example.com");
});

test("create: email sai định dạng bị từ chối", async () => {
  const service = new LeadService();
  const suffix = Date.now();

  await assert.rejects(
    async () => {
      await service.create({
        customerName: `KH Lead Email Sai ${suffix}`,
        phone: `090${String(suffix).slice(-7)}`,
        email: "khong-phai-email",
        group: "Lead KH mới",
        channel: "Online",
        channelSourceId: ONLINE_SOURCE_ID,
        staffName: "Nguyễn Thị Tình",
      });
    },
    (err: any) => {
      assert.ok(err instanceof LeadServiceError);
      assert.equal(err.message, "Email không hợp lệ");
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("update: sửa được email, và xóa trống email bằng chuỗi rỗng", async () => {
  const service = new LeadService();
  const suffix = Date.now();
  const lead = await service.create({
    customerName: `KH Lead Email Update ${suffix}`,
    phone: `090${String(suffix).slice(-7)}`,
    group: "Lead KH mới",
    channel: "Online",
    channelSourceId: ONLINE_SOURCE_ID,
    staffName: "Nguyễn Thị Tình",
  });

  const updated = await service.update(lead.id, { email: "moi@example.com" }, { isAdmin: true, name: "Admin Test" });
  assert.equal(updated.email, "moi@example.com");

  const cleared = await service.update(lead.id, { email: "" }, { isAdmin: true, name: "Admin Test" });
  assert.equal(cleared.email, null);
});
