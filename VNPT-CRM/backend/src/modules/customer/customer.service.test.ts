import { test } from "node:test";
import assert from "node:assert/strict";

const { initDatabase, run, query } = await import("../../database/db.js");
const { CustomerService, CustomerServiceError } = await import("./customer.service.js");

await initDatabase();

test("create stores contact and billing info separately", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Test Liên hệ ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    phone: `090${String(suffix).slice(-7)}`,
    contactName: "Chị Diễm",
    contactEmail: "diem@example.com",
    billingName: "Anh Khải",
    billingPhone: "0983036755",
    billingEmail: "khai@example.com",
  });

  assert.equal(result.customer.contact_name, "Chị Diễm");
  assert.equal(result.customer.contact_email, "diem@example.com");
  assert.equal(result.customer.billing_name, "Anh Khải");
  assert.equal(result.customer.billing_phone, "0983036755");
  assert.equal(result.customer.billing_email, "khai@example.com");
});

test("create and update store representative (người đại diện) fields, optional", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const created = await service.create({
    name: `Công ty Test Người Đại Diện ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    representativeName: "Nguyễn Văn A",
    representativeTitle: "Giám đốc",
    representativeIdNumber: "079094001234",
    representativeIdIssuedAt: "2020-05-10",
    representativeIdIssuedPlace: "Cục Cảnh sát QLHC về TTXH",
  });

  assert.equal(created.customer.representative_name, "Nguyễn Văn A");
  assert.equal(created.customer.representative_title, "Giám đốc");
  assert.equal(created.customer.representative_id_number, "079094001234");
  assert.equal(created.customer.representative_id_issued_at, "2020-05-10");
  assert.equal(created.customer.representative_id_issued_place, "Cục Cảnh sát QLHC về TTXH");

  const updated = await service.update(
    created.customer.id,
    { representativeName: "Trần Thị B", representativeTitle: "Phó giám đốc" },
    { name: "Quản trị viên", role: "Admin" }
  );
  assert.equal(updated.representative_name, "Trần Thị B");
  assert.equal(updated.representative_title, "Phó giám đốc");
  // Các trường khác không đụng tới vẫn giữ nguyên.
  assert.equal(updated.representative_id_number, "079094001234");
});

test("create without representative fields leaves them empty (không bắt buộc)", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Không Người Đại Diện ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });

  assert.equal(result.customer.representative_name, null);
  assert.equal(result.customer.representative_title, null);
});

test("create accepts PTM địa bàn group", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty PTM Địa Bàn ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "PTM địa bàn",
  });

  assert.equal(result.customer.customer_group, "PTM địa bàn");
});

test("create normalizes tax code", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Chuẩn Hóa MST ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    identityCode: "317424086",
  });

  assert.equal(result.customer.identity_code, "0317424086");
});

test("update by unrelated AM returns 403", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Sửa Quyền ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amStaff: `AM Chủ ${suffix}`,
    amCaringStaff: `AM Chủ ${suffix}`,
  });

  await assert.rejects(
    async () => {
      await service.update(
        result.customer.id,
        { note: "Cố sửa khách không phải của mình" },
        { name: `AM Khác ${suffix}`, role: "AM" }
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 403);
      return true;
    }
  );
});

test("update by Admin rejects an unknown am_staff with 400", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Đổi AM Sai ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });

  await assert.rejects(
    async () => {
      await service.update(
        result.customer.id,
        { amStaff: "Ai đó khác" },
        { name: "Admin", role: "Admin" }
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("update by Admin can change am_staff and am_caring_staff to active staff", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Admin Đổi AM ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amStaff: "Nguyễn Thị Tình",
    amCaringStaff: "Nguyễn Thị Tình",
  });

  const updated = await service.update(
    result.customer.id,
    { amStaff: "Phạm Thanh Hà", amCaringStaff: "Nguyễn Thị Huyền Trang" },
    { name: "Admin", role: "Admin" }
  );

  assert.equal(updated.am_staff, "Phạm Thanh Hà");
  assert.equal(updated.am_caring_staff, "Nguyễn Thị Huyền Trang");
});

test("update by AM cannot change am_staff (403) but may resubmit the same value", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty AM Không Đổi AM ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amStaff: "Nguyễn Thị Tình",
    amCaringStaff: "Nguyễn Thị Tình",
  });
  const operator = { name: "Nguyễn Thị Tình", role: "AM" };

  await assert.rejects(
    async () => {
      await service.update(result.customer.id, { amStaff: "Phạm Thanh Hà" }, operator);
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 403);
      return true;
    }
  );

  const same = await service.update(
    result.customer.id,
    { amStaff: "Nguyễn Thị Tình", note: "Giữ nguyên AM" },
    operator
  );
  assert.equal(same.am_staff, "Nguyễn Thị Tình");
  assert.equal(same.note, "Giữ nguyên AM");
});

test("update by AM: only the sales AM of the customer may change am_caring_staff", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty AM Đổi CSKH ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amStaff: "Nguyễn Thị Tình",
    amCaringStaff: "Phạm Thanh Hà",
  });

  await assert.rejects(
    async () => {
      await service.update(
        result.customer.id,
        { amCaringStaff: "Nguyễn Thị Huyền Trang" },
        { name: "Phạm Thanh Hà", role: "AM" }
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 403);
      return true;
    }
  );

  const updated = await service.update(
    result.customer.id,
    { amCaringStaff: "Nguyễn Thị Huyền Trang" },
    { name: "Nguyễn Thị Tình", role: "AM" }
  );
  assert.equal(updated.am_caring_staff, "Nguyễn Thị Huyền Trang");

  await assert.rejects(
    async () => {
      await service.update(
        result.customer.id,
        { amCaringStaff: "Nhân Viên Không Tồn Tại XYZ" },
        { name: "Nguyễn Thị Tình", role: "AM" }
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("create by AM forces am_staff to the actor and defaults am_caring_staff to the actor", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const operator = { name: "Nguyễn Thị Tình", role: "AM" };

  const own = await service.create(
    { name: `Công ty AM Tạo ${suffix}`, type: "Doanh nghiệp", customerGroup: "Tự phát triển" },
    operator
  );
  assert.equal(own.customer.am_staff, "Nguyễn Thị Tình");
  assert.equal(own.customer.am_caring_staff, "Nguyễn Thị Tình");

  const otherCaring = await service.create(
    {
      name: `Công ty AM Tạo CSKH ${suffix}`,
      type: "Doanh nghiệp",
      customerGroup: "Tự phát triển",
      amStaff: "Nguyễn Thị Tình",
      amCaringStaff: "Phạm Thanh Hà",
    },
    operator
  );
  assert.equal(otherCaring.customer.am_staff, "Nguyễn Thị Tình");
  assert.equal(otherCaring.customer.am_caring_staff, "Phạm Thanh Hà");

  await assert.rejects(
    async () => {
      await service.create(
        {
          name: `Công ty AM Tạo Hộ ${suffix}`,
          type: "Doanh nghiệp",
          customerGroup: "Tự phát triển",
          amStaff: "Phạm Thanh Hà",
        },
        operator
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 403);
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await service.create(
        {
          name: `Công ty AM CSKH Sai ${suffix}`,
          type: "Doanh nghiệp",
          customerGroup: "Tự phát triển",
          amCaringStaff: "Nhân Viên Không Tồn Tại XYZ",
        },
        operator
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("create by Admin validates chosen AM staff", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const admin = { name: "Admin", role: "Admin" };

  const ok = await service.create(
    {
      name: `Công ty Admin Chọn AM ${suffix}`,
      type: "Doanh nghiệp",
      customerGroup: "Tự phát triển",
      amStaff: "Phạm Thanh Hà",
      amCaringStaff: "Nguyễn Thị Huyền Trang",
    },
    admin
  );
  assert.equal(ok.customer.am_staff, "Phạm Thanh Hà");
  assert.equal(ok.customer.am_caring_staff, "Nguyễn Thị Huyền Trang");

  await assert.rejects(
    async () => {
      await service.create(
        {
          name: `Công ty Admin AM Sai ${suffix}`,
          type: "Doanh nghiệp",
          customerGroup: "Tự phát triển",
          amStaff: "Nhân Viên Không Tồn Tại XYZ",
        },
        admin
      );
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("create without services leaves services empty instead of defaulting", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const result = await service.create({
    name: `Công ty Không Dịch Vụ ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });

  assert.equal(result.customer.services, null);
});

test("referred CTV: create/update validate the CTV and the DTO carries its name and code", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const ctvId = `CTV-CUS-${suffix}`;
  const pendingCtvId = `CTV-CUS-PEND-${suffix}`;

  await run(
    "INSERT INTO users (id, username, name, role, status, referral_code) VALUES (?, ?, ?, ?, ?, ?)",
    [ctvId, `ctv_cus_${suffix}`, `CTV Giới Thiệu ${suffix}`, "CTV", "Đang hoạt động", `REF${suffix}`]
  );
  await run(
    "INSERT INTO users (id, username, name, role, status, referral_code) VALUES (?, ?, ?, ?, ?, ?)",
    [pendingCtvId, `ctv_cus_p_${suffix}`, `CTV Chờ Duyệt ${suffix}`, "CTV", "Chờ duyệt", `REFP${suffix}`]
  );

  // T6: "Kênh bán" dùng chung cơ chế chi tiết kênh với Lead/Đơn hàng — kênh
  // "CTV giới thiệu" bắt buộc đi kèm referredByCtvId, không còn là 2 trường rời rạc.
  const created = await service.create({
    name: `Công ty Có CTV ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    salesChannel: "CTV giới thiệu",
    referredByCtvId: ctvId,
  });
  assert.equal(created.customer.referred_by_ctv_id, ctvId);
  assert.equal(created.customer.referred_by_ctv_name, `CTV Giới Thiệu ${suffix}`);
  assert.equal(created.customer.referred_by_ctv_code, `REF${suffix}`);

  const options = await service.listCtvOptions();
  assert.ok(options.some((o) => o.id === ctvId && o.code === `REF${suffix}`));
  assert.ok(!options.some((o) => o.id === pendingCtvId));

  // Kênh CTV giới thiệu mà không chọn CTV -> 400.
  await assert.rejects(
    async () => {
      await service.create({
        name: `Công ty CTV Thiếu ${suffix}`,
        type: "Doanh nghiệp",
        customerGroup: "Tự phát triển",
        salesChannel: "CTV giới thiệu",
      });
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );

  for (const badId of ["CTV-KHONG-TON-TAI", pendingCtvId, "KH-NOT-A-CTV"]) {
    await assert.rejects(
      async () => {
        await service.create({
          name: `Công ty CTV Sai ${suffix}`,
          type: "Doanh nghiệp",
          customerGroup: "Tự phát triển",
          salesChannel: "CTV giới thiệu",
          referredByCtvId: badId,
        });
      },
      (err: any) => {
        assert.ok(err instanceof CustomerServiceError);
        assert.equal(err.status, 400);
        return true;
      }
    );
  }

  // Kênh khác CTV mà vẫn gắn CTV -> 400 (CTV chỉ gắn với đúng kênh "CTV giới thiệu").
  await assert.rejects(
    async () => {
      await service.create({
        name: `Công ty Kênh Khác Vẫn Gắn CTV ${suffix}`,
        type: "Doanh nghiệp",
        customerGroup: "Tự phát triển",
        salesChannel: "Online",
        referredByCtvId: ctvId,
      });
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );

  const plain = await service.create({
    name: `Công ty Gắn CTV Sau ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });
  const admin = { name: "Admin", role: "Admin" };
  const attached = await service.update(
    plain.customer.id,
    { salesChannel: "CTV giới thiệu", referredByCtvId: ctvId },
    admin
  );
  assert.equal(attached.referred_by_ctv_id, ctvId);
  assert.equal(attached.referred_by_ctv_name, `CTV Giới Thiệu ${suffix}`);

  // Đổi kênh ra khỏi CTV giới thiệu (và gỡ CTV cùng lúc) -> gỡ sạch.
  const cleared = await service.update(
    plain.customer.id,
    { salesChannel: "", referredByCtvId: "" },
    admin
  );
  assert.equal(cleared.referred_by_ctv_id, null);
  assert.equal(cleared.referred_by_ctv_name, null);

  await assert.rejects(
    async () => {
      await service.update(plain.customer.id, { referredByCtvId: "CTV-KHONG-TON-TAI" }, admin);
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );

  // Sửa trường khác không đụng kênh/CTV: dữ liệu chi tiết kênh cũ giữ nguyên, không bị bắt buộc lại.
  const untouched = await service.update(plain.customer.id, { note: "Ghi chú không liên quan" }, admin);
  assert.equal(untouched.note, "Ghi chú không liên quan");
  assert.equal(untouched.referred_by_ctv_id, null);
});

test("update by owning AM succeeds and does not change am_staff/am_caring_staff", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const amName = `AM Chủ Sở Hữu ${suffix}`;

  const result = await service.create({
    name: `Công ty Sửa Hợp Lệ ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    amStaff: amName,
    amCaringStaff: amName,
  });

  const updated = await service.update(
    result.customer.id,
    { note: "Đã liên hệ khách, hẹn gặp lại" },
    { name: amName, role: "AM" }
  );

  assert.equal(updated.note, "Đã liên hệ khách, hẹn gặp lại");
  assert.equal(updated.am_staff, amName);
});

test("assignStaffBulk updates caring staff for selected customers only", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const a = await service.create({
    name: `Công ty Bulk A ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tập hiện hữu",
  });
  const b = await service.create({
    name: `Công ty Bulk B ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tập hiện hữu",
  });
  const untouched = await service.create({
    name: `Công ty Bulk Không Chọn ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tập hiện hữu",
    amCaringStaff: "Nguyễn Thị Huyền Trang",
  });

  const result = await service.assignStaffBulk(
    {
      customerIds: [a.customer.id, b.customer.id],
      amCaringStaff: "Nguyễn Thị Tình",
    },
    "Admin Test"
  );

  assert.equal(result.updated, 2);

  const after = await service.getById(a.customer.id);
  assert.equal(after.am_caring_staff, "Nguyễn Thị Tình");
  const afterUntouched = await service.getById(untouched.customer.id);
  assert.notEqual(afterUntouched.am_caring_staff, "Nguyễn Thị Tình");
});

test("assignStaffBulk rejects unknown staff", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const created = await service.create({
    name: `Công ty Bulk Lỗi ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tập hiện hữu",
  });

  await assert.rejects(
    async () => {
      await service.assignStaffBulk({
        customerIds: [created.customer.id],
        amCaringStaff: "Nhân Viên Không Tồn Tại XYZ",
      });
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );
});

test("getById returns 404 for unknown id", async () => {
  const service = new CustomerService();
  await assert.rejects(
    async () => {
      await service.getById("KH-KHONG-TON-TAI");
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 404);
      return true;
    }
  );
});

// --- T6: Kênh bán hiện "kênh con" (chi tiết nguồn/đối tác) ---

test("salesChannel Online/Đối tác requires a matching channel_sources entry and the DTO carries its name", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  await run(
    "INSERT INTO channel_sources (id, kind, name, active, sort_order, created_at) VALUES (?, 'online', ?, TRUE, 1, ?)",
    [`CHS-CUS-${suffix}`, `Zalo Ads KH ${suffix}`, new Date().toISOString()]
  );

  await assert.rejects(
    async () => {
      await service.create({
        name: `Công ty Online Thiếu Nguồn ${suffix}`,
        type: "Doanh nghiệp",
        customerGroup: "Tự phát triển",
        salesChannel: "Online",
      });
    },
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 400);
      return true;
    }
  );

  const created = await service.create({
    name: `Công ty Online Có Nguồn ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
    salesChannel: "Online",
    channelSourceId: `CHS-CUS-${suffix}`,
  });
  assert.equal(created.customer.channel_source_id, `CHS-CUS-${suffix}`);
  assert.equal(created.customer.channel_source_name, `Zalo Ads KH ${suffix}`);
});

// --- T6: xóa Khách hàng (Admin-only, chặn khi còn đơn hàng) ---

test("delete: removes a customer without orders, blocks (409) one with orders", async () => {
  const service = new CustomerService();
  const suffix = Date.now();

  const free = await service.create({
    name: `Công ty Xóa Được ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });
  const result = await service.delete(free.customer.id, "Admin Test");
  assert.match(result.message, /Đã xóa khách hàng/);
  await assert.rejects(
    async () => service.getById(free.customer.id),
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 404);
      return true;
    }
  );

  const withOrder = await service.create({
    name: `Công ty Có Đơn ${suffix}`,
    type: "Doanh nghiệp",
    customerGroup: "Tự phát triển",
  });
  await run(
    `INSERT INTO contracts (
      id, transaction_code, customer_name, subscriber_codes, total_value, channel,
      deployment_status, payment_status, document_status, has_revenue, customer_id, am_staff
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `HD-DEL-${suffix}`,
      `GD-DEL-${suffix}`,
      withOrder.customer.name,
      "[]",
      1000000,
      "Trực tiếp",
      "Chưa triển khai",
      "Chưa thanh toán",
      "Soạn thảo",
      0,
      withOrder.customer.id,
      "AM Test",
    ]
  );

  await assert.rejects(
    async () => service.delete(withOrder.customer.id, "Admin Test"),
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 409);
      assert.match(err.message, /còn 1 đơn hàng/);
      return true;
    }
  );
  // Vẫn còn trong DB vì bị chặn.
  const stillThere = await service.getById(withOrder.customer.id);
  assert.equal(stillThere.id, withOrder.customer.id);
});

test("delete returns 404 for unknown id", async () => {
  const service = new CustomerService();
  await assert.rejects(
    async () => service.delete("KH-KHONG-TON-TAI", "Admin Test"),
    (err: any) => {
      assert.ok(err instanceof CustomerServiceError);
      assert.equal(err.status, 404);
      return true;
    }
  );
});

// --- T6: bỏ bắt buộc Phường/địa bàn ở nhập đợt KHDN-chăm ("append") ---

test("importBatch: territoryId is optional for append mode, still required for replace", async () => {
  const service = new CustomerService();
  const suffix = Date.now();
  const staffName = `AM-NoTer-${suffix}`;
  await run(
    "INSERT INTO staff (id, name, code, role, status) VALUES (?, ?, ?, ?, ?)",
    [`STF-NOTER-${suffix}`, staffName, `NV-NOTER-${suffix}`, "AM Bán chăm", "Đang hoạt động"]
  );

  const result = await service.importBatch({
    territoryId: null,
    amCaringStaff: staffName,
    handoverBatch: `DOT-NOTER-${suffix}`,
    mode: "append",
    customers: [{ identityCode: `MST-NOTER-${suffix}`, name: "Khách Không Phường" }],
  });
  assert.equal(result.createdCount, 1);

  const [row] = await query<any>("SELECT territory_id FROM customers WHERE identity_code = ?", [
    `MST-NOTER-${suffix}`,
  ]);
  assert.equal(row.territory_id, null);

  await assert.rejects(
    async () =>
      service.importBatch({
        territoryId: null,
        amCaringStaff: staffName,
        handoverBatch: `DOT-NOTER-REP-${suffix}`,
        mode: "replace",
        customers: [{ identityCode: `MST-NOTER-${suffix}`, name: "Khách Không Phường" }],
      }),
    /cần chọn Địa bàn/
  );
});
