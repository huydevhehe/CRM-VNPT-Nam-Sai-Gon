import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer, createCustomerForOrder } from "./helpers";

/**
 * Tạo buffer "giả làm .xlsx" là CSV UTF-8 có BOM — SheetJS tự nhận diện và
 * phân tích như CSV (xem customer-import.spec.ts). Tránh phải cài thêm
 * package `xlsx` cho frontend chỉ để dựng file test.
 */
function buildCsvBuffer(rows: Record<string, string>[], headers: string[]): Buffer {
  const escapeCsv = (value: string) =>
    value.includes(",") || value.includes('"') || value.includes("\n")
      ? `"${value.replace(/"/g, '""')}"`
      : value;

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsv(row[h] ?? "")).join(","));
  }
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(lines.join("\n") + "\n", "utf8")]);
}

const HEADERS = [
  "Tên khách hàng",
  "Mã thuê bao",
  "Tên dịch vụ",
  "Nhóm dịch vụ",
  "Hình thức thanh toán",
  "Ngày bắt đầu",
  "Ngày kết thúc",
];

interface PreviewRow {
  row: { serviceCode: string; [key: string]: unknown };
  status: string;
  existing?: { id: string };
  customer?: { id: string };
  resolved?: { startDate: string; expirationDate: string };
  notes: string[];
}

test.describe("API Import dịch vụ khách đang dùng (POST /api/services/import/preview, /commit)", () => {
  let adminToken: string;
  let amToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
  });

  test("AM gọi preview nhận lỗi 403", async ({ request }) => {
    const buffer = buildCsvBuffer([{ "Mã thuê bao": "SUB-403", "Tên dịch vụ": "FiberVNN" }], HEADERS);

    const res = await request.post(`${API_URL}/services/import/preview`, {
      headers: bearer(amToken),
      multipart: { file: { name: "import.xlsx", mimeType: "text/csv", buffer } },
    });

    expect(res.status()).toBe(403);
  });

  test("AM gọi commit nhận lỗi 403", async ({ request }) => {
    const res = await request.post(`${API_URL}/services/import/commit`, {
      headers: bearer(amToken),
      data: { decisions: [] },
    });
    expect(res.status()).toBe(403);
  });

  test("Admin preview rồi commit; import lại cùng file thành cập nhật, không nhân đôi", async ({ request }) => {
    const suffix = Date.now();
    const customer = await createCustomerForOrder(request, adminToken, {
      name: `Công ty Import Dịch Vụ ${suffix}`,
    });
    const orderCustomer = await createCustomerForOrder(request, adminToken, {
      name: `Công ty Dịch Vụ Từ Đơn ${suffix}`,
    });
    const code1 = `SUB-E2E-A-${suffix}`;
    const code2 = `SUB-E2E-B-${suffix}`;
    const orderCode = `SUB-E2E-ORDER-${suffix}`;
    const transactionCode = `GD-E2E-SVC-${suffix}`;

    const orderRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        transactionCode,
        customerId: orderCustomer.id,
        subscriberCodes: [orderCode],
        totalValue: 100000,
        channel: "Online",
      },
    });
    expect(orderRes.status()).toBe(201);

    const buffer = buildCsvBuffer(
      [
        {
          "Tên khách hàng": customer.name,
          "Mã thuê bao": code1,
          "Tên dịch vụ": "FiberVNN",
          "Nhóm dịch vụ": "BRCĐ",
          "Hình thức thanh toán": "Trả trước",
          "Ngày bắt đầu": "15/01/2030",
          "Ngày kết thúc": "2031-01-14",
        },
        {
          "Tên khách hàng": customer.name,
          "Mã thuê bao": code2,
          "Tên dịch vụ": "MyTV",
          "Nhóm dịch vụ": "Sai nhóm",
        },
        {
          "Tên khách hàng": orderCustomer.name,
          "Mã thuê bao": orderCode,
          "Tên dịch vụ": "Ghi đè đơn hàng",
        },
        {
          "Tên khách hàng": `Công ty Không Tồn Tại ${suffix}`,
          "Mã thuê bao": `SUB-E2E-NOCUST-${suffix}`,
          "Tên dịch vụ": "FiberVNN",
        },
      ],
      HEADERS
    );

    const preview = async () => {
      const res = await request.post(`${API_URL}/services/import/preview`, {
        headers: bearer(adminToken),
        multipart: { file: { name: "import.xlsx", mimeType: "text/csv", buffer } },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      return body.data as { rows: PreviewRow[]; summary: { total: number; new: number; update: number; error: number } };
    };
    const find = (rows: PreviewRow[], code: string): PreviewRow => {
      const found = rows.find((r) => r.row.serviceCode === code);
      if (!found) throw new Error(`Thiếu dòng preview ${code}`);
      return found;
    };

    const first = await preview();
    expect(first.summary).toEqual({ total: 4, new: 1, update: 0, error: 3 });
    const newRow = find(first.rows, code1);
    expect(newRow.status).toBe("new");
    expect(newRow.customer?.id).toBe(customer.id);
    expect(newRow.resolved?.startDate).toBe("2030-01-15");
    expect(newRow.resolved?.expirationDate).toBe("2031-01-14");
    expect(find(first.rows, code2).notes[0]).toContain("Nhóm dịch vụ không hợp lệ");
    expect(find(first.rows, orderCode).notes[0]).toBe(
      `Mã thuê bao thuộc đơn hàng ${transactionCode}, vui lòng chỉnh ở đơn hàng`
    );
    expect(find(first.rows, `SUB-E2E-NOCUST-${suffix}`).notes[0]).toBe(
      "Không tìm thấy khách hàng trong hệ thống"
    );

    const commit = async (rows: PreviewRow[], action: "create" | "update") => {
      const res = await request.post(`${API_URL}/services/import/commit`, {
        headers: bearer(adminToken),
        data: { decisions: rows.map((r) => ({ row: r.row, action })) },
      });
      expect(res.status()).toBe(200);
      return (await res.json()).data as {
        created: number;
        updated: number;
        skipped: number;
        errors: { rowNumber: number; message: string }[];
      };
    };

    const committed = await commit([newRow], "create");
    expect(committed).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(committed.errors).toHaveLength(0);

    const listServices = async () => {
      const res = await request.get(`${API_URL}/customers/${customer.id}/services`, {
        headers: bearer(adminToken),
      });
      expect(res.status()).toBe(200);
      return (await res.json()).data as {
        serviceCode: string;
        serviceName: string;
        serviceGroup: string | null;
        paymentType: string | null;
        startDate: string;
        expirationDate: string;
        contractId: string | null;
      }[];
    };

    const afterFirst = await listServices();
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]).toMatchObject({
      serviceCode: code1,
      serviceName: "FiberVNN",
      serviceGroup: "BRCĐ",
      paymentType: "Trả trước",
      startDate: "2030-01-15",
      expirationDate: "2031-01-14",
      contractId: null,
    });

    const second = await preview();
    expect(second.summary).toEqual({ total: 4, new: 0, update: 1, error: 3 });
    const updateRow = find(second.rows, code1);
    expect(updateRow.status).toBe("update");
    expect(updateRow.existing?.id).toBeTruthy();

    const reCommitted = await commit([updateRow], "update");
    expect(reCommitted).toMatchObject({ created: 0, updated: 1, skipped: 0 });
    expect(await listServices()).toHaveLength(1);

    const orderServices = await request.get(`${API_URL}/customers/${orderCustomer.id}/services`, {
      headers: bearer(adminToken),
    });
    const orderList = (await orderServices.json()).data as { serviceCode: string; serviceName: string }[];
    expect(orderList).toHaveLength(1);
    expect(orderList[0].serviceCode).toBe(orderCode);
  });
});
