import { expect, test } from "@playwright/test";
import { ADMIN, AM, API_URL, apiLogin, bearer, createCustomerForOrder, getDefaultAmName } from "./helpers";

/**
 * Tạo buffer "giả làm .xlsx" là CSV UTF-8 có BOM — SheetJS tự nhận diện và
 * phân tích như CSV (xem customer-import.spec.ts). Tránh phải cài thêm
 * package `xlsx` cho frontend chỉ để dựng file test.
 */
function buildContractCsvBuffer(rows: Record<string, string>[], headers: string[]): Buffer {
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
  "Mã giao dịch",
  "Tên khách hàng",
  "MST khách hàng",
  "Mã thuê bao",
  "Giá trị đơn hàng",
  "Kênh",
  "Gói cước",
  "AM phụ trách",
];

test.describe("API Import hợp đồng từ Excel (POST /api/contracts/import/preview, /commit)", () => {
  let adminToken: string;
  let amToken: string;
  let amName: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await apiLogin(request, ADMIN.username, ADMIN.password);
    amToken = await apiLogin(request, AM.username, AM.password);
    amName = await getDefaultAmName(request, adminToken);
  });

  test("dòng đơn hàng thiếu AM phát triển bị báo lỗi ở bước kiểm tra", async ({ request }) => {
    const suffix = Date.now();
    const customer = await createCustomerForOrder(request, adminToken, {
      name: `Công ty Import Thiếu AM ${suffix}`,
    });
    const buffer = buildContractCsvBuffer(
      [
        {
          "Mã giao dịch": `GD-NOAM-${suffix}`,
          "Tên khách hàng": customer.name,
          "Mã thuê bao": `0900000001${suffix}`.slice(-10),
          "Giá trị đơn hàng": "1000",
          Kênh: "Online",
        },
        {
          "Mã giao dịch": `GD-HASAM-${suffix}`,
          "Tên khách hàng": customer.name,
          "Mã thuê bao": `0900000002${suffix}`.slice(-10),
          "Giá trị đơn hàng": "1000",
          Kênh: "Online",
          "AM phụ trách": amName,
        },
      ],
      HEADERS
    );
    const res = await request.post(`${API_URL}/contracts/import/preview`, {
      headers: bearer(adminToken),
      multipart: { file: { name: "import.xlsx", mimeType: "text/csv", buffer } },
    });
    expect(res.status()).toBe(200);
    const { rows, summary } = (await res.json()).data as {
      rows: { row: { transactionCode: string }; status: string; notes: string[] }[];
      summary: { new: number; error: number };
    };
    expect(summary.new).toBe(1);
    expect(summary.error).toBe(1);
    const missing = rows.find((r) => r.row.transactionCode === `GD-NOAM-${suffix}`);
    expect(missing?.status).toBe("error");
    expect(missing?.notes[0]).toBe("Thiếu AM phát triển (bắt buộc)");
    expect(rows.find((r) => r.row.transactionCode === `GD-HASAM-${suffix}`)?.status).toBe("new");
  });

  test("AM gọi preview nhận lỗi 403", async ({ request }) => {
    const buffer = buildContractCsvBuffer(
      [{ "Mã giao dịch": "GD-403", "Tên khách hàng": "Công ty 403" }],
      HEADERS
    );

    const res = await request.post(`${API_URL}/contracts/import/preview`, {
      headers: bearer(amToken),
      multipart: { file: { name: "import.xlsx", mimeType: "text/csv", buffer } },
    });

    expect(res.status()).toBe(403);
  });

  test("preview phân loại mới / cập nhật / lỗi khách hàng, commit gắn khách theo MST và tên", async ({
    request,
  }) => {
    const suffix = Date.now();
    const existingCode = `GD-E2E-EXIST-${suffix}`;
    const newCode = `GD-E2E-NEW-${suffix}`;
    const noCustomerCode = `GD-E2E-NOCUST-${suffix}`;
    const mst = `03${String(suffix).slice(-8)}`;

    const oldCustomer = await createCustomerForOrder(request, adminToken, {
      name: `Công ty Hợp Đồng Cũ ${suffix}`,
    });
    const newCustomer = await createCustomerForOrder(request, adminToken, {
      name: `Công ty Hợp Đồng Mới ${suffix}`,
      identityCode: mst,
    });

    // Kênh "Online" bắt buộc chọn nguồn Online (T6) kể cả khi tạo đơn qua payload cũ.
    const channelSourcesRes = await request.get(`${API_URL}/channel-sources?kind=online`, {
      headers: bearer(adminToken),
    });
    const onlineSourceId = (await channelSourcesRes.json()).data?.[0]?.id;

    const existingRes = await request.post(`${API_URL}/contracts`, {
      headers: bearer(adminToken),
      data: {
        amStaff: await getDefaultAmName(request, adminToken),
        transactionCode: existingCode,
        customerId: oldCustomer.id,
        subscriberCodes: ["0900000000"],
        totalValue: 100000,
        channel: "Online",
        channelSourceId: onlineSourceId,
      },
    });
    expect(existingRes.status()).toBe(201);

    const buffer = buildContractCsvBuffer(
      [
        {
          "Mã giao dịch": existingCode,
          "Tên khách hàng": `Tên không có trong hệ thống ${suffix}`,
          "MST khách hàng": "",
          "Mã thuê bao": "0900000000",
          "Giá trị đơn hàng": "250000",
          Kênh: "",
          "Gói cước": "Home Net 2",
          "AM phụ trách": amName,
        },
        {
          "Mã giao dịch": newCode,
          "Tên khách hàng": `Tên khác trong file ${suffix}`,
          "MST khách hàng": mst,
          "Mã thuê bao": `0911${String(suffix).slice(-6)}`,
          "Giá trị đơn hàng": "500000",
          Kênh: "Online",
          "Gói cước": "",
          "AM phụ trách": amName,
        },
        {
          "Mã giao dịch": noCustomerCode,
          "Tên khách hàng": `Công ty Không Tồn Tại ${suffix}`,
          "MST khách hàng": "",
          "Mã thuê bao": `0922${String(suffix).slice(-6)}`,
          "Giá trị đơn hàng": "1000",
          Kênh: "Online",
          "Gói cước": "",
          "AM phụ trách": amName,
        },
      ],
      HEADERS
    );

    const previewRes = await request.post(`${API_URL}/contracts/import/preview`, {
      headers: bearer(adminToken),
      multipart: { file: { name: "import.xlsx", mimeType: "text/csv", buffer } },
    });
    expect(previewRes.status()).toBe(200);
    const previewBody = await previewRes.json();
    expect(previewBody.success).toBe(true);

    const { rows, summary } = previewBody.data;
    expect(summary.new).toBe(1);
    expect(summary.update).toBe(1);
    expect(summary.error).toBe(1);

    interface PreviewClassifiedRow {
      row: { transactionCode: string; [key: string]: unknown };
      status: string;
      existing?: { id: string; transaction_code: string };
      customer?: { id: string };
      notes: string[];
    }
    const typedRows = rows as PreviewClassifiedRow[];

    const updateRow = typedRows.find((r) => r.row.transactionCode === existingCode);
    const newRow = typedRows.find((r) => r.row.transactionCode === newCode);
    const errorRow = typedRows.find((r) => r.row.transactionCode === noCustomerCode);
    if (!updateRow || !newRow || !errorRow) {
      throw new Error("Thiếu dòng preview mong đợi");
    }

    expect(updateRow.status).toBe("update");
    expect(updateRow.existing?.transaction_code).toBe(existingCode);
    expect(updateRow.customer).toBeUndefined();
    expect(newRow.status).toBe("new");
    expect(newRow.customer?.id).toBe(newCustomer.id);
    expect(errorRow.status).toBe("error");
    expect(errorRow.notes[0]).toBe("Không tìm thấy khách hàng trong hệ thống (MST/tên)");

    const commitRes = await request.post(`${API_URL}/contracts/import/commit`, {
      headers: bearer(adminToken),
      data: {
        decisions: [
          { row: updateRow.row, action: "update" },
          { row: newRow.row, action: "create" },
          { row: errorRow.row, action: "create" },
        ],
      },
    });
    expect(commitRes.status()).toBe(200);
    const commitBody = await commitRes.json();
    expect(commitBody.success).toBe(true);
    expect(commitBody.data.created).toBe(1);
    expect(commitBody.data.updated).toBe(1);
    expect(commitBody.data.errors).toHaveLength(1);
    expect(commitBody.data.errors[0].message).toBe(
      "Không tìm thấy khách hàng trong hệ thống (MST/tên)"
    );

    const listRes = await request.get(`${API_URL}/contracts`, { headers: bearer(adminToken) });
    const listBody = await listRes.json();
    const contracts = listBody.data as {
      transactionCode: string;
      customerId: string | null;
      customerName: string;
      totalValue: number;
      channel: string;
      packageName: string | null;
    }[];

    const updatedContract = contracts.find((c) => c.transactionCode === existingCode);
    expect(updatedContract?.customerId).toBe(oldCustomer.id); // không khớp khách -> giữ khách cũ
    expect(updatedContract?.customerName).toBe(oldCustomer.name);
    expect(updatedContract?.totalValue).toBe(250000);
    expect(updatedContract?.channel).toBe("Online"); // rỗng trong file -> giữ nguyên giá trị cũ
    expect(updatedContract?.packageName).toBe("Home Net 2");

    const createdContract = contracts.find((c) => c.transactionCode === newCode);
    expect(createdContract?.customerId).toBe(newCustomer.id);
    expect(createdContract?.customerName).toBe(newCustomer.name);
    expect(createdContract?.totalValue).toBe(500000);
    expect(createdContract?.channel).toBe("Online");

    expect(contracts.find((c) => c.transactionCode === noCustomerCode)).toBeUndefined();
  });

  test("AM gọi commit nhận lỗi 403", async ({ request }) => {
    const res = await request.post(`${API_URL}/contracts/import/commit`, {
      headers: bearer(amToken),
      data: { decisions: [] },
    });
    expect(res.status()).toBe(403);
  });
});
