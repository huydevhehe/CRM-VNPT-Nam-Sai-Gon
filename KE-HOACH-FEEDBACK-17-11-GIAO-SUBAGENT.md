# KẾ HOẠCH XỬ LÝ FEEDBACK KHÁCH NGÀY 17/11/2026 — HƯỚNG DẪN CHO SUBAGENT

> Viết cho: các subagent lập trình, mỗi con nhận **một nhiệm vụ (T1…T10)**. Đọc phần 0–3 (chung) rồi chỉ làm đúng nhiệm vụ của mình.
> Nguồn yêu cầu gốc: file `Web_CRM_vnpthcmc.com.vn.xlsx` ở gốc dự án, sheet **"Góp ý  Phản hồi"** (người yêu cầu: Vũ Tiến Khoa). Trích dẫn dưới đây ghi **STT** (cột A) và **dòng Excel**.
> Các sheet khác trong file là dữ liệu tham chiếu: **"Hợp đồng"** (các trường của từng mẫu hợp đồng), **"Dịch vụ"** (danh mục + giá gói cước), **"Danh mục giải pháp CNTT"** (7 nhóm), **"Lead"** (3 loại lead), **"Khách hàng"**, **"Nhân viên"**.

---

## 0. LUẬT BẤT DI BẤT DỊCH (vi phạm = làm lại)

1. **KHÔNG BAO GIỜ** ghi dấu vết AI vào bất cứ đâu: không `Co-Authored-By`, không "Generated with…", không nhắc Claude/AI/Anthropic trong code, comment, test, tên file, commit, PR.
2. **Subagent KHÔNG chạy `git add/commit/push/merge/checkout/reset/stash`.** Chỉ sửa file trong working tree. Người điều phối (leader) gom và commit sau khi user duyệt. Commit message luôn tiếng Anh, ngắn, kiểu Conventional Commits.
3. **Giao diện và thông báo lỗi hiển thị cho người dùng: tiếng Việt có dấu.** Tên hàm/biến/file: tiếng Anh.
4. **Không đụng file của nhiệm vụ khác** (xem bảng sở hữu file ở mục 2). Nếu bắt buộc phải sửa file người khác: dừng, ghi vào báo cáo cuối, không tự sửa.
5. **Không xóa dữ liệu thật, không chạy lệnh phá hoại** (`rm -rf` ngoài thư mục tạm của mình, `DROP` DB không phải của mình). Không dùng DB `vnpt_crm_test` (DB dùng chung của user).
6. **Chặn quyền ở API, không chỉ ẩn ở giao diện.** Mọi endpoint mới phải có `requireAuth` + (nếu cần) `requireAdmin`/scope theo AM (`resolveStaffScope` ở `backend/src/middleware/actor.ts`), có test 401/403.
7. **Schema chỉ được thêm (additive)**: dùng `ensureColumn` / `runMigrationOnce` (mẫu trong `backend/src/database/schema-extensions.ts`). Không đổi tên/xóa cột cũ. Dữ liệu cũ phải còn đọc được sau migration và migration phải chạy lặp lại không lỗi.
8. Không thêm dependency nặng khi chưa cần. Nếu cần thư viện mới: nêu lý do trong báo cáo, kiểm tra tương thích React 19 / Next 16 và `npm run build` không vỡ.
9. Không sửa/bỏ test cũ cho "xanh" — nếu test cũ sai vì yêu cầu mới thì cập nhật test cho đúng yêu cầu và nói rõ trong báo cáo.
10. Việc nào **chưa chắc ý khách** thì chọn mặc định an toàn đã ghi trong tài liệu này; nếu tài liệu không nói gì, ghi câu hỏi vào báo cáo cuối thay vì tự bịa nghiệp vụ.

## 1. BỐI CẢNH KỸ THUẬT (đọc để khỏi mò)

- Monorepo: `backend/` (Express + PostgreSQL + TypeScript, test bằng `node:test`), `frontend/` (Next.js 16 App Router, Tailwind, Playwright e2e).
- Vai trò: **Admin**, **AM**, **AM Bán chăm** (+ CTV tách riêng). `resolveStaffScope(req)`: `null` = Admin xem hết; AM chỉ thấy dữ liệu của mình. Ma trận quyền một nguồn: `backend/src/constants/permissions.ts` (khi thêm module/chức năng mới phải thêm dòng vào đây). Menu/guard admin-only: `frontend/lib/auth/access.ts`, `components/admin/layout/AdminSidebar.tsx`, `app/admin/layout.tsx`.
- Đơn hàng = bảng `contracts` (1 dòng = 1 mã giao dịch `transaction_code`). Dịch vụ sinh từ đơn bằng `syncServicesFromContract` (`backend/src/modules/service/contract-service-sync.ts`). Đề nghị thanh toán: `backend/src/modules/contract/payment-request.service.ts` + mẫu `backend/templates/de-nghi-thanh-toan.docx` (Docxtemplater).
- Hoa hồng: `backend/src/modules/commission/*`. Hiện chỉ tự tạo khi đơn chuyển "Hoàn tất" **và** `contracts.referred_by_ctv_id` có giá trị (`contract.service.ts` ~dòng 467). Đơn nhập tay hiện **không có chỗ chọn CTV** nên không bao giờ có `referred_by_ctv_id` (chỉ kế thừa từ Lead ~dòng 322) → đây là nguyên nhân của STT 14.
- Lead: `backend/src/modules/lead/lead.service.ts`. Trạng thái (dòng ~81): `Mới tiếp nhận → Đã liên hệ → Đang tư vấn → Chốt thành công | Thất bại`. Kênh: `LEAD_CHANNELS` ở `backend/src/constants/org.ts:14` = `Online, CTV giới thiệu, Khách hàng hiện hữu, Đối tác, Chiến dịch`. Hình thức thanh toán: `PAYMENT_METHODS` (`org.ts:71`).
- Nhắc hạn: `backend/src/modules/reminder/*` (`reminder-settings.service.ts` = cấu hình chung, `reminder-template.service.ts` = mẫu theo nhóm dịch vụ, `reminder-runner.ts`).
- Frontend gọi API qua `frontend/lib/api/*.api.ts`; kiểu dữ liệu ở `frontend/lib/crm/types/crm.types.ts`.

## 2. QUY TẮC CHẠY SONG SONG (tránh dẫm chân nhau)

### 2.1 Thứ tự đợt (wave)

| Đợt | Nhiệm vụ chạy song song | Điều kiện sang đợt sau |
|---|---|---|
| **1** | T1, T2, T3, T4, T5 | Cả 5 xong, leader chạy lại test + kiểm tra bằng FE thật, user duyệt |
| **2** | T6, T7 | Như trên |
| **3** | T8 → T9 → T10 (tuần tự, đơn hàng nhiều dòng) | Như trên |
| **Hoãn** | T11 (Dịch vụ & Cảnh báo) | Làm sau cùng, chưa giao |

### 2.2 Bảng sở hữu file (chỉ chủ nhiệm vụ mới sửa)

| Nhiệm vụ | Sở hữu |
|---|---|
| T1 | `backend/src/modules/lead/**`, module mới `backend/src/modules/channel-source/**`, `frontend/app/admin/leads/**`, trang mới `frontend/app/admin/channel-sources/**`, component mới `frontend/components/admin/shared/ChannelDetailPicker.tsx` |
| T2 | `backend/src/modules/contract/**`, `frontend/app/admin/contracts/**`, `backend/src/constants/org.ts` (chỉ `PAYMENT_METHODS`), `backend/templates/de-nghi-thanh-toan.docx` |
| T3 | `backend/src/modules/staff/**`, `frontend/app/admin/employees/**`, `frontend/components/admin/staff/**` |
| T4 | `backend/src/modules/reminder/**`, `frontend/app/admin/reminders/**` (và component soạn thảo mới của nó) |
| T5 | `frontend/components/admin/layout/AdminTopbar.tsx`, `frontend/app/admin/commissions/**`, `frontend/app/admin/kpi-settings/**` (tên thư mục thật: kiểm tra), `frontend/app/admin/services/page.tsx`, component mới `frontend/components/admin/shared/ConfirmDeleteDialog.tsx`, `backend/src/modules/commission/**` (chỉ phần DTO/nhãn nếu cần) |
| T6 | `frontend/app/admin/customers/**`, `frontend/components/admin/customer/**`, `backend/src/modules/customer/**`, **và** phần kênh/CTV của `backend/src/modules/contract/contract.service.ts` + `frontend/app/admin/contracts/page.tsx` (T2 đã xong ở đợt 1) |
| T7 | Nút xóa ở: Lead (`app/admin/leads`), Công việc, Dịch vụ thủ công, Phường/địa bàn, CTV… (T7 tự lập bảng audit, xem 6.7). **Không** đụng Khách hàng và Đơn hàng |
| T8–T10 | `backend/src/modules/contract/**`, `backend/src/modules/service/contract-service-sync.ts`, `frontend/app/admin/contracts/**`, `frontend/components/admin/contract/**`, `frontend/public/templates/*.xlsx` liên quan đơn hàng |

### 2.3 File dùng chung — sửa **một dòng**, đọc lại ngay trước khi sửa

`backend/src/database/schema-extensions.ts`, `backend/src/server.ts` (mount route), `backend/src/constants/permissions.ts`, `frontend/lib/auth/access.ts`, `AdminSidebar.tsx`.
Cách làm an toàn: **tạo file migration riêng** `backend/src/database/ext/<task>.ts` xuất `async function apply<Task>Schema()`, rồi chỉ thêm **một dòng gọi** vào `schema-extensions.ts`. Nếu Edit báo file đã đổi → đọc lại rồi sửa tiếp, không ghi đè.

### 2.4 Môi trường test — BẮT BUỘC cách ly

- **Mỗi agent một DB riêng**: `DATABASE_URL=postgres://postgres@localhost:5432/vnpt_crm_<tag>` (`<tag>` = mã nhiệm vụ, vd `t1`). Tạo bằng `"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -c "create database vnpt_crm_t1"`; **xóa DB khi xong**.
- **Mỗi agent một cổng backend riêng**: T1→8101, T2→8102, T3→8103, T4→8104, T5→8105, T6→8106, T7→8107, T8–T10→8108. Đặt `PORT` và `CORS_ORIGIN` khớp frontend nếu chạy UI.
- Test backend chạy **từng file một trên DB sạch** (một số file test xóa sạch staff/customers): `npx tsx --test src/modules/...`.
- **Frontend dev server chỉ được chạy một cái tại một thời điểm** (cùng thư mục `frontend/`). Dùng khóa nguyên tử: lấy khóa bằng `mkdir "$TEMP/vnpt-next-dev.lock"` (thất bại = đang có người dùng, chờ 30s rồi thử lại), chạy `npx next dev --webpack -p 31<NN>` (Turbopack bị lỗi Google Fonts), **trả khóa bằng `rmdir` ngay khi xong và tắt server**, kể cả khi lỗi. **Cấm chạy `next build`** (đụng `.next`); kiểm tra kiểu bằng `npx tsc --noEmit` trong `frontend/` và `backend/`.
- Playwright e2e: `E2E_BASE_URL`, `E2E_API_URL`, `--workers=1`. Tài khoản mẫu: `admin / admin@Vnpt2026`, AM `VNPT-AM-01 / VNPT-AM-01@Vnpt2026` (xem `frontend/e2e/api/helpers.ts`). Test API (`frontend/e2e/api/*.spec.ts`) không cần `next dev`.
- Dọn sau khi xong: tắt mọi tiến trình mình bật, xóa DB của mình, xóa file ảnh chụp/`.playwright-mcp` mình tạo.

## 3. CHUẨN HOÀN THÀNH & MẪU BÁO CÁO

Mỗi nhiệm vụ chỉ được coi là xong khi:
1. `npx tsc --noEmit` sạch ở `backend/` và `frontend/` (nếu có đụng).
2. Test backend liên quan **xanh**, có test mới cho logic mới (gồm 401/403 và biên dữ liệu).
3. Có (hoặc cập nhật) spec e2e API cho endpoint mới; spec UI nếu thay đổi giao diện.
4. Đã **tự kiểm tra như người dùng thật** trên FE local (khi có khóa dev server) và chụp lại ít nhất 1 ảnh minh họa đặt trong thư mục tạm, xóa sau khi báo cáo.
5. Báo cáo cuối (ngắn, tiếng Việt) gồm: **đã làm gì theo từng STT**, **file đã sửa/tạo**, **migration thêm gì**, **test đã chạy + kết quả thật**, **việc chưa làm/câu hỏi tồn đọng**, **mặc định đã tự chọn**. Không báo "xong" nếu còn test đỏ — nói rõ test nào đỏ và vì sao.

---

# PHẦN 4 — CÁC QUYẾT ĐỊNH ĐÃ CHỐT VỚI USER (không hỏi lại)

| # | Chốt |
|---|---|
| Q-xóa | Admin cần **nút xóa** cho các dữ liệu do người dùng thêm vào (để dọn dữ liệu khi chuyển sang server mới). |
| Q-sửa-Lead | Khách đòi Admin sửa được thông tin Lead → **cho sửa**. |
| Q-lùi-bước | Thực hiện đúng nguyên văn STT 3 (xem T1). |
| Q-kênh | Danh sách nguồn **Online** và **Đối tác** làm **danh sách cố định có thể thêm/sửa/ẩn** (admin tự quản). |
| Q-đơn-nhiều-dịch-vụ | "Khách nói sao thì làm kỹ như vậy" → làm đúng STT 10, 11. |
| Q-ngày-nhắc | Số ngày nhắc hạn phải **tự cấu hình được** (không hard-code), theo từng nhóm dịch vụ. |
| Q-hoãn | **Dịch vụ & Cảnh báo (tách 2 menu, ZNS/Zalo Group Bot, báo giá tự động, tự tạo Lead CNTT)** làm **sau cùng** (T11), chưa giao. |

---

# PHẦN 5 — NHIỆM VỤ ĐỢT 1

## T1 — Lead + Danh mục kênh dùng chung

**Yêu cầu gốc**
- STT 2 (dòng 4): "User Admin có thể sửa thông tin trong Lead" → Admin phải sửa được thông tin Lead.
- STT 3 (dòng 5): "Nhân viên thao tác các tiến trình không quay lại bước trước, muốn quay lại phải tao tác duyệt của Admin hoặc Admin cập nhật".
- STT 4 (dòng 6): "Không cần hiển thị cột Phường".
- STT 5 (dòng 7): "Hiển thị chi tiết của Kênh phát triển. Ví dụ: Kênh - Online thì xác định được online từ nguồn nào (Zalo Ads, Facebook, Website a, website b,..); Kênh - Đối tác - Thì hiển thị đối tác nào; Kênh - Cộng tác viên - Thì hiển thị CTV nào".

**Việc cần làm**

1. **Bỏ cột "Phường" khỏi bảng Lead** và khỏi bộ lọc (`frontend/app/admin/leads/page.tsx` ~dòng 269–273 và ~361–363). Giữ nguyên cột DB và API (chỉ ẩn trên giao diện, không bắt buộc ở form Lead nếu hiện đang bắt buộc — kiểm tra).
2. **Admin sửa thông tin Lead**: thêm `PATCH /api/leads/:id` (chỉ Admin) cho các trường thông tin: tên khách, số điện thoại, email (nếu có), kênh + chi tiết kênh, giá trị dự kiến, mô tả nhu cầu, người phụ trách (đã có endpoint riêng, giữ). Giao diện: nút **Sửa** trên dòng Lead mở form sửa (dùng lại form tạo). Ghi audit log. AM/AM Bán chăm **không** có quyền sửa tổng quát (chỉ ghi chú/trạng thái như hiện tại). Cập nhật `permissions.ts` cho đúng.
3. **Chặn lùi bước + xin duyệt** (đúng nguyên văn: "muốn quay lại phải thao tác duyệt của Admin hoặc Admin cập nhật"):
   - Thứ tự bước: `Mới tiếp nhận (0) → Đã liên hệ (1) → Đang tư vấn (2) → Chốt thành công (3) | Thất bại (3)`. Bước 3 là điểm cuối (hai trạng thái ngang hàng).
   - Quy tắc cho **nhân viên (không phải Admin)**: được đi **tiến** (nhảy cách bước vẫn được) và được chuyển sang `Thất bại` từ bước 0–2. **Lùi bước** (về thứ hạng thấp hơn, hoặc từ `Chốt thành công`/`Thất bại` về bất kỳ bước nào, hoặc đổi qua lại giữa hai trạng thái cuối) → API trả **409** với thông điệp "Không thể quay lại bước trước. Hãy gửi yêu cầu để Admin duyệt." và **không đổi** trạng thái.
   - **Admin** được đổi sang bất kỳ trạng thái nào trực tiếp ("Admin cập nhật").
   - **Yêu cầu duyệt** ("thao tác duyệt của Admin"): bảng mới `lead_stage_requests(id, lead_id, from_status, to_status, reason, requested_by, status ['Chờ duyệt'|'Đã duyệt'|'Từ chối'], decided_by, decided_at, decision_note, created_at)`. Endpoint: nhân viên `POST /leads/:id/stage-requests` (bắt buộc `reason`, chỉ khi thực sự là lùi bước, chỉ trên Lead thuộc phạm vi của mình, không tạo trùng khi đã có yêu cầu "Chờ duyệt"); Admin `GET /leads/stage-requests?status=`, `PATCH /leads/stage-requests/:id` (`approve|reject` + ghi chú). Duyệt = áp dụng đổi trạng thái trong cùng transaction. Giao diện: ở dòng Lead, nhân viên thấy nút "Yêu cầu quay lại bước…" khi bị chặn; Admin có tab/khối **"Yêu cầu chờ duyệt"** kèm số lượng trên trang Leads. Ghi audit log.
   - Kiểm tra mọi nơi khác đổi trạng thái Lead (kéo thả Kanban nếu có, import, "tạo đơn từ Lead") để không lách quy tắc.
4. **Danh mục kênh dùng chung** (T6 sẽ gắn vào Đơn hàng và Khách hàng, nên làm gọn, tái sử dụng được):
   - Bảng `channel_sources(id, kind ['online'|'partner'], name, active, sort_order, created_at)`, unique (kind, lower(name)). Seed `online`: **Zalo Ads, Facebook, Website** (ví dụ khách nêu; admin tự thêm "Website A/B…"). `partner`: để trống (admin tự thêm).
   - API: `GET /api/channel-sources?kind=&includeInactive=` (mọi user đăng nhập), `POST/PATCH/DELETE` chỉ Admin (xóa: nếu đã được dùng thì chuyển `active=false` thay vì xóa, trả thông báo rõ).
   - Trang admin mới **"Danh mục kênh"** (menu chỉ Admin): 2 khối "Nguồn Online" và "Đối tác", thêm/sửa tên/ẩn/sắp xếp. Thêm vào `access.ts`, sidebar, `permissions.ts`.
   - Cột mới `leads.channel_source_id` (nullable). Quy tắc: kênh **Online** → bắt buộc chọn nguồn online; kênh **Đối tác** → bắt buộc chọn đối tác; kênh **CTV giới thiệu** → bắt buộc chọn CTV (đã có `referred_by_ctv_id`, giữ nguyên); các kênh khác không có chi tiết. Validate ở backend (chọn nguồn không đúng loại → 400).
   - Component dùng chung `ChannelDetailPicker` (props: `channel`, `value`, `onChange`, hiển thị đúng ô chọn theo kênh, có chữ "Chi tiết kênh"). Form Lead dùng component này; bảng Lead thêm cột **"Chi tiết kênh"** (vd `Online › Zalo Ads`, `Đối tác › ABC`, `CTV › Nguyễn Văn A`).
   - Lead đã tồn tại không có chi tiết: vẫn hiển thị bình thường (chi tiết trống "—"), không bắt buộc khi chỉ đổi ghi chú.

**Test tối thiểu**: lùi bước bị 409 với nhân viên, Admin đổi tự do; vòng đời yêu cầu duyệt (tạo/trùng/duyệt/từ chối/403 cho nhân viên duyệt); Admin PATCH thông tin Lead, AM bị 403; ràng buộc chi tiết kênh theo từng kênh; danh mục kênh CRUD + 403 cho non-admin.

---

## T2 — Đơn hàng: sửa nhanh + xuất PDF

**Yêu cầu gốc**
- STT 6 (dòng 8): "Hình thức thanh toán => Trả trước thì phải có trả trước bao nhiêu tháng, 3 6 12 18 24 (chủ yếu 6 12). Hình thức thanh toán bổ sung => Theo hợp đồng".
- STT 7 (dòng 9): "Không cần dữ liệu Phường".
- STT 9 (dòng 11): "Bắt buộc có AM phát triển".
- STT 12 (dòng 14): "Xuất đề nghị thanh toán cho view xem trước, cho tải PDF hoặc .doc. Số văn bản đề nghị không lấy liền mà xác nhận lấy thì mới lấy".
- STT 13 (dòng 15): "Giá trị tiền hiển thị dấu chấm (.) để chia tách các hàng tiền trăm, triệu".

**Việc cần làm**

1. **Hình thức thanh toán**: `PAYMENT_METHODS` thêm `"Theo hợp đồng"` (giữ `Trả trước`, `Trả hàng tháng`). Cột mới `contracts.prepaid_months` (int, nullable). Khi chọn `Trả trước` → bắt buộc chọn **3, 6, 12, 18 hoặc 24** tháng (ô chọn, mặc định gợi ý 12; 6 và 12 hiển thị lên đầu/đánh dấu "phổ biến"). Hình thức khác → xóa `prepaid_months`. Validate backend (giá trị ngoài danh sách → 400). Hiển thị ở bảng đơn và form sửa; trong đề nghị thanh toán ghi "Trả trước 12 tháng" thay vì chỉ "Trả trước". Đơn cũ `Trả trước` chưa có số tháng: vẫn hiển thị bình thường, **chỉ bắt buộc khi tạo mới hoặc khi sửa hình thức**.
2. **Bỏ "Phường" khỏi Đơn hàng**: ẩn ô chọn Phường ở form, bỏ cột/bộ lọc ở bảng, không còn bắt buộc ở API. Giữ cột DB cũ và dữ liệu cũ. Kiểm tra file mẫu nhập hợp đồng (`frontend/public/templates/mau-nhap-hop-dong.xlsx`) và parser nhập (`contract-import`): bỏ cột Phường nếu có (file nhập cũ có cột Phường vẫn phải đọc được, bỏ qua giá trị). **Không** làm hỏng báo cáo địa bàn đang dùng `territory_id` — nếu có báo cáo dựa vào đó, báo trong báo cáo cuối thay vì tự sửa.
3. **AM phát triển bắt buộc**: backend `create` bắt buộc `amStaff` (Admin phải chọn; AM/AM Bán chăm vẫn bị ép về chính mình như hiện tại; đơn tạo từ Lead lấy AM của Lead, nếu Lead trống AM thì bắt chọn). Form: dấu `*`, báo lỗi tiếng Việt "Vui lòng chọn AM phát triển". Nhập Excel hợp đồng: dòng thiếu AM → báo lỗi dòng đó ở bước kiểm tra. Đơn cũ thiếu AM: vẫn mở/sửa được các trường khác; chỉ chặn khi lưu mà `amStaff` rỗng **và** người dùng đang sửa chính trường đó? → Chọn mặc định: **khi sửa đơn cũ thiếu AM, bắt buộc điền AM trước khi lưu** (nói rõ trong báo cáo).
4. **Xuất đề nghị thanh toán**: đã có xem trước (`GET/PATCH /:id/payment-request/preview`) và xuất `.docx`; số văn bản chỉ lưu khi xuất (`recordExport`). Việc cần làm: (a) rà lại giao diện để **xem trước → sửa → xác nhận** rõ ràng, số văn bản chỉ được "chốt" khi người dùng bấm xác nhận xuất (viết test chứng minh: xem trước nhiều lần **không** làm tăng số, hai người xuất liên tiếp nhận số liên tiếp không trùng không lỗ); (b) thêm nút **Tải PDF** cạnh **Tải DOC(X)**: dùng LibreOffice headless (`soffice --headless --convert-to pdf`) chuyển từ chính file docx đã render; nếu máy không có `soffice` → trả 501 với thông điệp tiếng Việt rõ ràng, giao diện hiện thông báo và vẫn cho tải DOCX. **Ghi vào báo cáo**: lệnh cài trên server Ubuntu (`sudo apt install -y libreoffice-writer`) để leader/user chạy. Không cache file PDF trên đĩa quá một request (xóa file tạm). Số văn bản của PDF và DOCX phải **cùng một số** cho một lần xác nhận.
5. **Dấu chấm phân cách tiền**: rà **toàn bộ** các trang admin (`grep` `toLocaleString`, `Intl.NumberFormat`, hiển thị `đ`) để mọi số tiền hiển thị dạng `1.234.567 ₫`/`1.234.567 đ` (locale `vi-VN`). Ô **nhập** tiền ở form đơn hàng (Giá trị đơn hàng, thanh toán…) phải **hiển thị dấu chấm ngay khi gõ** (tạo component `MoneyInput` dùng chung ở `frontend/components/admin/shared/`, giá trị gửi API vẫn là số nguyên). Danh sách trang đã rà + trang đã sửa ghi vào báo cáo.

**Test tối thiểu**: validate tháng trả trước (hợp lệ/ngoài danh sách/hình thức khác), AM bắt buộc (Admin, AM, từ Lead), xem trước không tiêu số, xuất PDF (có `soffice` thì kiểm tra header `%PDF`; không có thì test nhánh 501), `MoneyInput` (e2e UI).

---

## T3 — Nhân viên

**Yêu cầu gốc**
- STT 22 (dòng 27): "Mặc định hiển thị những nhân viên trạng thái đang hoạt động".
- STT 23 (dòng 28): "Một nhân viên phụ trách nhiều Phường thì sao ?" (câu hỏi khách → cần **trả lời bằng chức năng**: một nhân viên có thể phụ trách nhiều Phường và nhìn thấy rõ).

**Việc cần làm**
1. Trang Nhân viên: thêm bộ lọc trạng thái, **mặc định "Đang hoạt động"** (các lựa chọn: Đang hoạt động / Đình chỉ / Đã ngừng / Tất cả — dùng đúng các trạng thái thật trong hệ thống). Ghi nhớ lựa chọn trong phiên không bắt buộc. Tìm kiếm/đếm số lượng vẫn đúng theo bộ lọc. Cập nhật e2e hiện có nếu chúng giả định thấy tất cả nhân viên ngay.
2. **Nhiều Phường / nhân viên**: đọc `backend/src/modules/territory/**` và form nhân viên (staff có trường `territory` đơn lẻ không? — kiểm tra thật, báo cáo trước đây nói quan hệ nằm ở `territories.staff_name`). Làm:
   - Trong panel **Xem nhân viên** (`StaffOverviewModal`) thêm tab/khối **"Phường phụ trách"**: liệt kê **tất cả** Phường mà nhân viên đó đang được gán (và số lượng), kèm đường dẫn sang trang địa bàn nếu có.
   - Ở form Thêm/Sửa nhân viên: nếu hiện chỉ cho chọn **một** Phường, đổi thành **chọn nhiều** (hoặc chỉ hiển thị + hướng dẫn gán ở trang địa bàn nếu việc sửa form làm hỏng dữ liệu địa bàn). Chọn phương án an toàn, **không làm vỡ trang Địa bàn/Phường**; nêu phương án đã chọn trong báo cáo.
   - API `GET /staff/:id/overview` thêm mảng `territories`; không lộ trường nhạy cảm; Admin-only như hiện tại.

**Test tối thiểu**: overview trả đúng danh sách nhiều Phường; nhân viên chưa có Phường → danh sách rỗng; bộ lọc mặc định (e2e UI).

---

## T4 — Nhắc hết hạn Email: soạn thảo định dạng, chữ ký, cấu hình theo nhóm

**Yêu cầu gốc**
- STT 20 (dòng 25): "Bổ sung bảng gõ viết đậm, in nghêng, tô màu trong nội dung email, Thêm thông tin chữ ký mail" (hiểu: thanh công cụ định dạng — đậm, nghiêng, tô màu).
- STT 21 (dòng 26): "Cấu hình nhắc hết hạn theo từng kịch bản, từng nhóm dịch vụ hết hạn khác nhau".
- User bổ sung: "có thể tự chỉnh sửa số ngày tự cấu hình được không cho dễ" → **số ngày nhắc phải sửa được trên giao diện**.

**Việc cần làm**
1. **Trình soạn thảo rich-text** cho nội dung mẫu email (mẫu chung và mẫu theo nhóm): thanh công cụ **Đậm, Nghiêng, Gạch chân, Màu chữ, Tô nền (highlight), Danh sách, Liên kết, Xóa định dạng**. Các biến `{…}` hiện có (6 biến) phải **vẫn chèn được** (nút/menu chèn biến) và vẫn được thay thế khi gửi. Lưu nội dung dạng HTML (cột mới/đổi nơi lưu theo cách additive; mẫu cũ dạng text thuần được hiển thị đúng, xuống dòng = `<br>`).
   - **Làm sạch HTML ở backend** (allowlist thẻ: `p, br, b, strong, i, em, u, span[style color/background-color], ul, ol, li, a[href http/https/mailto]`) — chống XSS/HTML injection ở cả khi lưu lẫn khi gửi. Có test.
   - Email gửi đi: multipart HTML + bản text thuần suy ra từ HTML. Xem trước (preview) và "gửi thử" dùng đúng HTML đó.
   - Chọn thư viện (gợi ý: Tiptap với extension color/highlight; hoặc trình soạn nhẹ tự viết). Phải tương thích React 19, build được (`tsc`), không phình bundle admin quá mức. Nêu lý do chọn.
2. **Chữ ký mail**: cấu hình chữ ký (HTML, cùng trình soạn thảo, có thể có link/số điện thoại/tên đơn vị) lưu ở cài đặt nhắc hạn; **tự động chèn vào cuối mọi email nhắc** (khách + nhân viên), có công tắc bật/tắt; xem trước hiển thị kèm chữ ký. Nội dung chữ ký thật do khách cung cấp sau — mặc định để trống/ví dụ rõ là mẫu.
3. **Cấu hình số ngày nhắc theo nhóm dịch vụ, sửa trực tiếp trên giao diện**:
   - Hiện `reminder_settings` có **một** `days_before` chung. Thêm bảng `reminder_group_settings(service_group PK, enabled, days_before JSON, updated_at)` (additive). Quy tắc: nhóm **có** dòng cấu hình → dùng ngày của nhóm; **không có** → dùng cấu hình chung. Ràng buộc giống cấu hình chung (số nguyên, 1–10 giá trị, không trùng, sắp xếp giảm dần).
   - Giao diện: ở mỗi nhóm dịch vụ (chỗ đang sửa mẫu theo nhóm) thêm ô **"Nhắc trước … ngày"** dạng chip thêm/xóa số (vd 60, 30, 15, 7, 1), nút "Dùng cấu hình chung", công tắc bật/tắt nhắc cho nhóm đó. Hiển thị rõ nhóm nào đang dùng chung/riêng.
   - `reminder-runner` đọc cấu hình theo nhóm của từng dịch vụ; cập nhật test runner/scheduler (không phá luồng gửi hiện tại, idempotent theo ngày/dịch vụ/mốc).
   - Chỉ làm kênh **Email** ở T4; ZNS/Zalo Group nằm ở T11 (hoãn). Thiết kế cấu hình **chừa chỗ** cho kênh khác (vd cột `channels` JSON mặc định `["email"]`) nhưng không hiện UI cho kênh chưa có.

**Test tối thiểu**: sanitize HTML (script, `onerror`, `javascript:` bị loại), biến thay thế đúng trong HTML, fallback chung↔nhóm, runner chọn đúng mốc theo nhóm, chữ ký có/không, preview, API 401/403.

---

## T5 — Việc nhỏ gom lại

**Yêu cầu gốc**
- STT 1 (dòng 2): "Không tự đổi Pass đăng nhập được".
- STT 14 (dòng 16) và STT 15 (dòng 17): "Đơn hàng hoàn tất không tự động chuyển sang theo dõi trạng thái hoa hồng" và "Bổ sung trạng thái của Chi kênh, Hoa hồng nhận, Còn lại = hoa hồng nhận - hoa hồng đã chi" (phần **hiển thị/nhãn** làm ở T5; phần **tự động tạo hoa hồng** làm ở T6).
- STT 18 (dòng 20): "Chưa hiểu rõ chức năng của menu này" (menu Dịch vụ và cảnh báo).
- Dòng 24 (STT 19, mục "Cấu hình KPI"): "Hướng dẫn sử dụng".

**Việc cần làm**
1. **Đổi mật khẩu**: trang `/doi-mat-khau` và API `POST /api/auth/change-password` **đã có**. Việc cần làm: thêm mục **"Đổi mật khẩu"** vào menu người dùng ở `AdminTopbar` (cạnh Đăng xuất), kiểm tra luồng đủ cho Admin/AM/AM Bán chăm/CTV (đổi xong còn đăng nhập được, token cũ xử lý hợp lý, kiểm tra mật khẩu cũ, thông báo lỗi tiếng Việt). Bổ sung e2e nếu chưa có.
2. **Hoa hồng — nhãn và số liệu** (`frontend/app/admin/commissions/page.tsx`, đang có `amount`/`paidOutAmount`/`remaining`): đổi nhãn cho khớp từ ngữ của khách: **"Hoa hồng nhận"** (= `amount`), **"Đã chi"** (= `paidOutAmount`), **"Còn lại"** (= nhận − đã chi, chữ nhỏ ghi công thức), thêm nhãn trạng thái chi tính từ số liệu: **"Chưa chi" / "Chi một phần" / "Đã chi hết"** (không đổi cấu trúc DB nếu tính được). Giữ cách gọi cũ trong tooltip để người dùng cũ không bị lạc. Không đổi logic tính tiền.
3. **Cấu hình KPI — "Hướng dẫn sử dụng"**: đọc `backend/src/modules/kpi/*`, `constants/org.ts` (khóa chỉ tiêu như `thu_ngay`, `thu_luy_ke`…) rồi viết khối **"Hướng dẫn sử dụng"** (thu gọn/mở rộng, đặt ở đầu trang cấu hình KPI): mỗi chỉ tiêu tính thế nào, mục tiêu mặc định, ngưỡng điểm đang áp dụng, cách sửa và khi nào có hiệu lực. **Viết đúng theo code thực tế**, không bịa; chỗ nào chưa chắc ghi "Cần xác nhận". Ghi chú: ngưỡng điểm `thu_luy_ke` đang sao chép từ `thu_ngay`, chờ khách xác nhận.
4. **Trang "Dịch vụ & Cảnh báo hết hạn"** (khách chưa hiểu): thêm khung giới thiệu ngắn đầu trang (3–4 dòng: trang này để làm gì, dữ liệu lấy từ đâu — dịch vụ sinh từ đơn hàng/nhập Excel, cảnh báo hạn dựa vào ngày hết hạn, ý nghĩa các thẻ số và nút "Tạo việc"). Các thẻ KPI trên trang hiện là **số cứng** ("2.816", "38", "12", "42") → nếu có API/dữ liệu thật thì nối vào, nếu chưa thì **đánh dấu rõ** hoặc ẩn thay vì hiển thị số giả (ghi vào báo cáo cách đã xử lý). Nút "Cấu hình mốc cảnh báo" đang chỉ `alert(...)` → đổi thành chuyển tới trang cấu hình nhắc hạn (`/admin/reminders`) hoặc ẩn đi, không để nút giả.
5. **Component dùng chung `ConfirmDeleteDialog`** (`frontend/components/admin/shared/ConfirmDeleteDialog.tsx`) cho T6/T7/T10: props `open, title, description (hiện tên bản ghi), blockedReason?, loading, onConfirm, onCancel`; nút xóa đỏ, nút Hủy, đóng bằng Esc/bấm ngoài, hiển thị lỗi 409 từ server (thông điệp tiếng Việt). Có `data-testid` ổn định (`confirm-delete-dialog`, `confirm-delete-submit`, `confirm-delete-cancel`).

**Test tối thiểu**: e2e đổi mật khẩu từ menu; e2e hiển thị nhãn hoa hồng; component dialog (UI e2e hoặc kiểm tra thủ công + ảnh).

---

# PHẦN 6 — NHIỆM VỤ ĐỢT 2

## T6 — Kênh chi tiết cho Đơn hàng và Khách hàng + CTV → hoa hồng tự động + xóa Khách hàng

**Yêu cầu gốc**
- STT 8 (dòng 10): "Kênh phải cho chọn chi tiết kênh nào, chi tiết của kênh chọn" (Đơn hàng).
- STT 14 (dòng 16): "Đơn hàng hoàn tất không tự động chuyển sang theo dõi trạng thái hoa hồng".
- STT 16 (dòng 18): "Chưa có dữ liệu Team, Không cần gán Phường/địa bàn, Kênh bán show ra các kênh con của kênh bán".
- STT mới (21, bổ sung 18/11): "Đối với dịch vụ Hóa đơn điện tử => Bổ sung thêm trường thông tin Link, user, Pass đăng nhập hệ thống hóa đơn".
- Xóa dữ liệu (Q-xóa) cho Khách hàng.

**Điều kiện trước**: T1 (danh mục kênh + `ChannelDetailPicker`) và T2 (đơn hàng sửa nhanh) và T5 (`ConfirmDeleteDialog`) đã xong.

**Việc cần làm**
1. **Đơn hàng — chi tiết kênh**: thêm `contracts.channel_source_id` (nullable); form đơn dùng `ChannelDetailPicker` y như Lead (Online → nguồn, Đối tác → đối tác, **CTV giới thiệu → chọn CTV**). Cột mới "Chi tiết kênh" ở bảng đơn. Đơn tạo từ Lead **kế thừa** kênh + chi tiết + CTV của Lead (cho sửa trước khi lưu). Validate backend giống T1.
2. **CTV → hoa hồng tự động (gốc của STT 14)**: khi đơn có kênh `CTV giới thiệu` thì **bắt buộc chọn CTV** → lưu `referred_by_ctv_id` (hiện form đơn nhập tay **không có** trường này nên không bao giờ sinh hoa hồng). Khi đơn chuyển "Hoàn tất" mà có CTV → sinh bản ghi hoa hồng (cơ chế sẵn ở `contract.service.ts` ~467, `commission.service.createForContract`, đã idempotent). Bổ sung: (a) sửa đơn đổi/thêm CTV **sau** khi đã Hoàn tất → nếu chưa có hoa hồng thì sinh, nếu đã có thì **không** tự ghi đè (báo thông điệp); (b) đơn Hoàn tất **không** có CTV → hiển thị gợi ý rõ ở chi tiết đơn "Đơn không có CTV nên không phát sinh hoa hồng" (đừng im lặng); (c) **backfill an toàn**: script/migration chỉ đọc-thống kê (không tự sinh hàng loạt) liệt kê các đơn Hoàn tất có kênh CTV nhưng thiếu `referred_by_ctv_id` để user quyết định xử lý tay. Test: đơn CTV→Hoàn tất sinh hoa hồng đúng 1 lần (gọi nhiều lần không trùng).
   *Không có quy tắc hoa hồng cho đơn AM thường — khách chưa yêu cầu; đừng tự thêm.*
3. **Khách hàng — "Kênh bán" hiện kênh con**: "Kênh bán" của khách dùng cùng cơ chế: chọn kênh → chọn **chi tiết** (nguồn Online / Đối tác / CTV) bằng `ChannelDetailPicker`; cột `customers.channel_source_id` (nullable); hiển thị `Online › Zalo Ads` ở danh sách và chi tiết khách; bộ lọc theo kênh vẫn hoạt động. Import Excel khách hàng (`mau-nhap-khach-hang.xlsx`): thêm cột "Chi tiết kênh" **tùy chọn** (khớp tên với danh mục; không khớp → cảnh báo dòng, không chặn).
4. **Khách hàng — bỏ bắt buộc Phường/địa bàn**: ở form "bàn giao đợt" (`app/admin/customers/page.tsx` ~dòng 1121–1126 đang `required`) bỏ bắt buộc; kiểm tra form thêm/sửa khách và import không còn đòi Phường. Giữ trường dạng tùy chọn.
5. **Team**: khách báo "chưa có dữ liệu Team" nhưng code đã có `customer_teams`/`team_id` (cột Team, "Quản lý Team", "Gán Team"). **Không xây lại.** Việc cần làm: kiểm tra trên FE thật rằng cột Team hiển thị và gán được; nếu **danh sách Team rỗng** thì trang cần có **hướng dẫn rõ "Chưa có Team — bấm Quản lý Team để tạo"** (khách có thể thấy trống và tưởng chưa làm). Ghi kết quả vào báo cáo.
6. **Xóa Khách hàng** (Admin-only): `DELETE /api/customers/:id` (403 non-admin, 404 không tồn tại). **Quy tắc mặc định**: nếu khách còn **đơn hàng** hoặc **Lead đã chuyển đổi/Hoa hồng** liên quan → **409** liệt kê số lượng ("Khách còn 3 đơn hàng, hãy xóa đơn trước") và không xóa. Nếu chỉ còn dữ liệu phụ (giấy tờ đính kèm, dịch vụ nhập tay, liên hệ, ghi chú) → xóa cùng transaction và **xóa luôn file giấy tờ trên đĩa**. Ghi audit log. Nút **Xóa** ở dòng/chi tiết khách (chỉ Admin thấy) dùng `ConfirmDeleteDialog`.

7. **Thông tin đăng nhập hệ thống Hóa đơn điện tử** (STT mới): với dịch vụ thuộc nhóm/tên "Hóa đơn điện tử" (hoặc combo có hóa đơn), thêm 3 trường trên dịch vụ/khách: `invoice_portal_url`, `invoice_portal_username`, `invoice_portal_password` (additive, nullable). **Mật khẩu phải mã hóa khi lưu** (vd AES-GCM với khóa từ biến môi trường `INVOICE_CREDENTIAL_KEY`, không lưu plaintext); API trả về mật khẩu **ẩn** (vd `"••••••"`) cho danh sách/xem thường, chỉ **Admin** gọi một endpoint riêng (`GET /services/:id/invoice-credential/reveal`, có ghi audit log ai xem) mới thấy plaintext giải mã. Giao diện: ở chi tiết dịch vụ/khách có khối "Thông tin đăng nhập hệ thống hóa đơn" (Link, Tài khoản, Mật khẩu ẩn + nút "Hiện mật khẩu" chỉ Admin, nút sao chép). Không áp dụng cho dịch vụ khác nhóm. Validate: có mật khẩu thì bắt buộc có tài khoản; link phải là URL hợp lệ nếu nhập.

**Test tối thiểu**: ràng buộc chi tiết kênh trên đơn/khách; đơn CTV → Hoàn tất sinh hoa hồng (1 lần); xóa khách (admin ok, AM 403, bị chặn khi còn đơn, xóa sạch file); import khách có/không chi tiết kênh; mật khẩu hóa đơn mã hóa ở DB (không phải chuỗi gốc), AM không gọi được endpoint reveal (403), Admin reveal được + có audit log.

---

## T7 — Nút xóa dữ liệu (trừ Khách hàng và Đơn hàng)

**Yêu cầu gốc**: STT 1 (dòng 3) "Admin có thể xóa các record" — user giải thích: là **các dữ liệu người dùng thêm vào mà không thấy nút xóa**, cần để dọn dữ liệu khi chuyển sang server mới.

**Việc cần làm**
1. **Kiểm kê trước** (đọc code thật, đừng đoán): với **mọi trang admin có form "Thêm/Tạo"**, liệt kê thực thể → có `DELETE` ở backend chưa → có nút xóa ở UI chưa. Kết quả ghi thành **bảng trong báo cáo cuối** (cột: trang, thực thể, backend, UI, việc đã làm). Ứng viên cần xét: Lead, Công việc (tasks), Dịch vụ nhập tay (đã có `DELETE` admin ở `service.controller.ts` — UI chưa chắc có), Phường/Địa bàn và cán bộ/liên hệ địa bàn, Tài khoản CTV, Team khách (đã có), giấy tờ khách (đã có), KPI/nhắc hạn nếu có bản ghi tạo tay, bản ghi nhật ký… (Khách hàng làm ở T6, Đơn hàng ở T10).
2. Với mỗi thực thể thiếu: thêm `DELETE /api/<tài nguyên>/:id` **chỉ Admin** (`requireAdmin`), 404 nếu không có, **409 + thông điệp tiếng Việt** khi còn dữ liệu liên kết quan trọng (vd Lead đã tạo đơn → không xóa; CTV còn hoa hồng chưa tất toán → không xóa), xóa phụ thuộc không quan trọng trong cùng transaction, **ghi audit log** (ai xóa, bản ghi nào). Xóa **mềm hay cứng**: dùng **xóa cứng** cho dữ liệu nhập tay không có liên kết; nếu thực thể đã có cơ chế "ngừng/ẩn" (vd nhân viên, CTV) **giữ nguyên cơ chế đó**, chỉ thêm xóa cứng khi chưa từng phát sinh dữ liệu.
3. UI: nút **Xóa** màu đỏ chỉ hiển thị cho Admin (kiểm tra `useAuth`), dùng `ConfirmDeleteDialog` từ T5, sau khi xóa làm mới danh sách, hiển thị lỗi 409 trong dialog.
4. Cập nhật `permissions.ts` (chức năng xóa = Admin).
5. **Tùy chọn (chỉ làm nếu `DataTable` hỗ trợ chọn nhiều dòng dễ dàng, nếu không bỏ qua và ghi vào báo cáo)**: chọn nhiều dòng → "Xóa đã chọn" (tối đa 100/lần, trả báo cáo từng dòng thành công/bị chặn).

**Test tối thiểu**: mỗi DELETE mới có test 401/403/404/409/200; spec UI: Admin thấy nút xóa, AM không thấy và gọi API trực tiếp bị 403.

---

# PHẦN 7 — NHIỆM VỤ ĐỢT 3 (ĐƠN HÀNG NHIỀU DỊCH VỤ + HỢP ĐỒNG) — TUẦN TỰ

**Yêu cầu gốc**
- STT 10 (dòng 12): "Một đơn hàng (Mã GD), có thể có nhiều dịch vụ, gói cước, mỗi dịch vụ tương ứng 1 mã thuê bao, có thể có đơn hàng mua thiết bị TOKEN 162.000".
- STT 11 (dòng 13): "Một mã GD bắt buộc phải có 1 hợp đồng, theo bộ hợp đồng mẫu đã gửi".
- STT 12 (xem T2): đề nghị thanh toán cho nhiều dòng.

Đây là thay đổi cấu trúc lớn nhất. **Một người một lượt, không song song.** T8 xong và leader kiểm tra rồi mới sang T9, rồi T10.

## T8 — Backend: đơn hàng nhiều dòng

1. **Bảng `contract_items`**: `id, contract_id (FK ON DELETE CASCADE), line_no, line_type ['service'|'device'], service_group, service_name, package_name, subscriber_code (nullable), quantity (>=1, mặc định 1), unit_price, amount, term_months (nullable), start_date (nullable), note, created_at`. Quy tắc: `service` → **bắt buộc đúng 1 `subscriber_code`** (không trống, không trùng trong cùng đơn), `quantity` = 1; `device` (vd **TOKEN, giá tham khảo 162.000đ**) → **không có mã thuê bao**, có số lượng/đơn giá; `amount = quantity × unit_price` (server tính, không tin client); đơn phải có **≥ 1 dòng**.
2. **Tổng tiền đơn** `contracts.total_value` = **tổng `amount`** các dòng (server tính). Giữ các cột cũ (`service_name`, `package_name`, `subscriber_codes`…) như **bản tóm tắt suy ra từ dòng** để báo cáo/dashboard/KPI/hoa hồng đang đọc cột cũ **không bị vỡ**. Kiểm tra mọi nơi đọc các cột đó (grep) và ghi danh sách vào báo cáo.
3. **Migration dữ liệu cũ** (`runMigrationOnce`, lặp lại không lỗi): mỗi đơn cũ có N mã thuê bao → tạo N dòng `service` (chia đều `total_value`, phần dư vào dòng đầu; ghi chú "Tách tự động từ đơn cũ"); đơn không có mã → 1 dòng `service` không mã **chỉ khi** dữ liệu cũ như vậy (cho phép dòng `service` không mã thuê bao **riêng cho dữ liệu migrate**, đánh dấu `legacy=true`, không cho tạo mới kiểu đó).
4. **API**: `POST/PUT /contracts` nhận mảng `items`; trả về `items` kèm đơn; vẫn nhận payload cũ (1 dịch vụ + danh sách mã phân tách bằng dấu phẩy) và **tự mở rộng thành các dòng** để import/test cũ không gãy. Validation đầy đủ, thông điệp tiếng Việt, ghi audit. Phân quyền scope AM giữ nguyên.
5. **Đồng bộ dịch vụ**: viết lại `syncServicesFromContract` để sinh **mỗi dòng `service` một dòng `services`** (mỗi mã thuê bao một dịch vụ, gắn `contract_id`), dòng `device` **không** sinh dịch vụ. Xóa dòng/đơn → xóa dịch vụ sinh ra; bảo toàn quy tắc "dịch vụ sinh từ đơn không sửa/xóa tay" đã có. `customers.services`/`nearest_expiration` tính lại đúng (đã khử trùng tên).
6. **Hoa hồng/thanh toán/đề nghị thanh toán** dùng tổng mới; đề nghị thanh toán nhiều dòng → các placeholder lặp (bảng) hoặc nối "Gói cước: A; B", "Mã thuê bao: x, y" tùy mẫu docx (T9 hoàn thiện mẫu).
7. **Test**: tạo đơn nhiều dòng (2 dịch vụ + 1 thiết bị TOKEN), tổng đúng, thiết bị không sinh dịch vụ, dịch vụ trùng mã bị 400, sửa số dòng cập nhật dịch vụ, payload cũ vẫn chạy, migration lặp lại không nhân đôi, KPI/dashboard/hoa hồng vẫn đúng. Chạy lại toàn bộ test liên quan đơn/dịch vụ/hoa hồng/import.

## T9 — Frontend: form nhiều dòng + nhập Excel + đề nghị thanh toán

1. **Form Tạo/Sửa đơn**: phần "Dịch vụ trong đơn" là bảng dòng có nút **Thêm dòng**, **Xóa dòng**; mỗi dòng chọn **Loại** (Dịch vụ / Thiết bị), nhóm dịch vụ, tên dịch vụ, gói cước, **mã thuê bao** (bắt buộc với Dịch vụ, ẩn với Thiết bị), số lượng, đơn giá (`MoneyInput` của T2), thành tiền tự tính, tổng đơn hiển thị lớn bên dưới. Gợi ý nhanh nút "+ Thiết bị TOKEN (162.000)" điền sẵn giá (người dùng sửa được). Mở đơn cũ (đã migrate) hiển thị đúng các dòng. Đơn tạo từ Lead giữ thông tin cũ.
2. **Bảng danh sách đơn**: hiển thị tóm tắt ("2 dịch vụ + 1 thiết bị"), mở rộng dòng/hoặc chi tiết để xem từng dòng + mã thuê bao. Bộ lọc/tìm theo mã thuê bao tìm trong mọi dòng.
3. **Nhập Excel hợp đồng**: định dạng mới **một dòng Excel = một dòng dịch vụ/thiết bị, cùng `Mã giao dịch` được gom thành một đơn**; vẫn đọc được file mẫu cũ (một ô nhiều mã phân tách dấu phẩy → mở rộng). Cập nhật `mau-nhap-hop-dong.xlsx` (có sheet hướng dẫn + dòng ví dụ) và bước xem trước (hiển thị đơn gom, lỗi theo dòng). Nhập thêm cột Loại dòng, số lượng, đơn giá.
4. **Đề nghị thanh toán**: mẫu `de-nghi-thanh-toan.docx` + `payment-request.service.ts` dùng dữ liệu nhiều dòng (bảng các dòng nếu mẫu cho phép; nếu mẫu chỉ có ô đơn → nối chuỗi theo quy ước ở T8). Bảng trường của mẫu ở sheet "Hợp đồng" cột "Đề nghị thanh toán". Xem trước hiển thị đúng. PDF (T2) vẫn hoạt động.
5. **e2e UI**: tạo đơn 2 dịch vụ + TOKEN → xem chi tiết khách có đúng 2 dịch vụ (thiết bị không sinh dịch vụ) → sửa bớt 1 dòng → dịch vụ giảm tương ứng. Cập nhật spec cũ giả định 1 dịch vụ/đơn.

## T10 — Hợp đồng bắt buộc theo bộ mẫu + xóa đơn hàng

**Cách hiểu STT 11** (đã chọn, ghi vào báo cáo để user xác nhận): mỗi **Mã giao dịch** phải gắn **đúng 1 hợp đồng** chọn từ **bộ hợp đồng mẫu** khách đã gửi, và hệ thống **xuất được file hợp đồng** từ mẫu đó điền sẵn dữ liệu đơn/khách.

1. **Chọn mẫu hợp đồng bắt buộc** khi tạo đơn: danh sách theo sheet "Hợp đồng": `Fiber (Mẫu 05)`, `BHXH`, `Chữ ký số + BHXH`, `CKS SmartCA CN thuộc DN`, `Chữ ký số TOKEN, SMARTCA DN`, `Hóa đơn điện tử`, `Combo (Hóa đơn + CKS)`. (Mẫu "Đề nghị thanh toán" là văn bản riêng đã có, không nằm trong danh sách này.) Cột `contracts.contract_template` (nullable cho dữ liệu cũ; **bắt buộc khi tạo mới**); `contract_number` (số hợp đồng) giữ cơ chế tự sinh nếu trống, `signed_date` đã có. Đơn cũ thiếu mẫu: vẫn xem/sửa được, **bắt buộc chọn mẫu trước khi chuyển "Hoàn tất"**. Nhập Excel: thêm cột "Mẫu hợp đồng" bắt buộc (cập nhật template xlsx).
2. **Xuất hợp đồng** từ mẫu docx. Hiện trong repo **có sẵn** các mẫu: `Smart CA CN thuộc DN/` (`HỢP ĐỒNG.docx`, phụ lục, `ĐIỀU KHOẢN CHUNG.docx`), `Chữ ký số TOKEN, SMARTCA DN/` (`HD.docx`, `PHỤ LỤC CA.docx`, `ĐIỀU KHOẢN CHUNG.docx`), `HỢP ĐỒNG HÓA ĐƠN NEW.docx`, `HỢP ĐỒNG CA VÀ HÓA ĐƠN NEW.docx`. **Chưa có file docx** cho `Fiber (Mẫu 05)`, `BHXH`, `Chữ ký số + BHXH` → với 3 mẫu này nút "Xuất hợp đồng" hiện trạng thái **"Chưa có mẫu"** (vô hiệu hóa, có chú thích), **không tự bịa nội dung**; ghi rõ trong báo cáo để user gửi file.
   - Mở từng docx, tìm cách khách đánh dấu chỗ điền (số thứ tự `(1)…(34)` trong sheet "Hợp đồng" tương ứng từng vị trí trong mẫu). Lập **bảng ánh xạ** `contract-templates/<mẫu>.mapping.ts`: mỗi số → nguồn dữ liệu (khách: tên, MST, người đại diện, chức vụ, CCCD, địa chỉ…; đơn: số hợp đồng, ngày ký, gói cước, mã thuê bao, hình thức thanh toán, tổng tiền, bằng chữ…; nhân viên giao dịch). Trường **không có dữ liệu trong CRM** (vd số tài khoản, người được ủy quyền) → **để trống có đánh dấu**, không điền bậy; liệt kê các trường thiếu trong báo cáo để user quyết định có thêm vào form khách không.
   - Dùng cùng công nghệ với đề nghị thanh toán (Docxtemplater) hoặc cách phù hợp với cách đánh dấu thực tế của mẫu; nếu mẫu không có placeholder chuẩn, **chuyển bản sao mẫu** sang placeholder `{...}` đặt trong `backend/templates/contracts/` (không sửa file gốc của khách). Có xem trước nội dung trước khi tải; hỗ trợ tải DOCX và PDF (dùng cơ chế PDF của T2).
   - Đơn nhiều dòng (T8): bảng "Tên dịch vụ/Số lượng/Đơn giá/Thành tiền" lặp theo dòng; tổng, VAT 8%, bằng chữ tính đúng.
3. **Xóa Đơn hàng** (Admin-only, `DELETE /api/contracts/:id`): xóa cùng transaction các dòng, dịch vụ sinh ra, thanh toán, lịch sử xuất đề nghị thanh toán; **chặn 409** khi đơn đã có **hoa hồng đã chi** (nếu hoa hồng chưa chi thì xóa theo đơn và ghi audit). Nút **Xóa** ở bảng/chi tiết đơn (chỉ Admin) dùng `ConfirmDeleteDialog`, thông báo rõ những gì sẽ bị xóa kèm (N dịch vụ, N thanh toán).
4. **Test**: tạo đơn không chọn mẫu → 400; xuất hợp đồng từng mẫu có sẵn (file mở được, không còn `{`/placeholder thô); mẫu chưa có → 4xx rõ ràng; xóa đơn (cascade, chặn khi đã chi hoa hồng, 403 non-admin).

---

# PHẦN 8 — HOÃN: T11 DỊCH VỤ & CẢNH BÁO (CHƯA GIAO, GHI CHÚ ĐỂ SAU)

User: "tạm làm sau cùng đi khá nhiều". **Không giao cho subagent ở các đợt trên.** Lưu nguyên văn để khỏi mất:

- STT 19 (dòng 21): "Nên tách riêng Dịch vụ và cảnh báo là 2 menu con riêng. **Dịch vụ**: bao gồm các dịch vụ VNPT cung cấp cho khách hàng, theo mẫu Sheet dịch vụ, tùy biến động để admin chủ động thêm gói cước giá cước. **Cảnh báo**: Theo kịch bản mỗi dịch vụ sẽ có kịch bản riêng. Phát triển cảnh báo nhắc qua ZNS + Tin nhắn Group Zalo OA (Bot nhóm Zalo (Zalo Group Bot))".
- Dòng 22 (mục Dịch vụ): "Phát triển theo hướng tự động làm báo giá theo form mẫu".
- Dòng 23 (mục Cảnh báo): "Chỉ hiển thị các thuê bao nằm trong điều kiện cảnh báo, và tạo thành Lead đối với các dịch vụ thuộc nhóm CNTT, An toàn bảo mật thông tin, và giao Lead đúng về cho AM chăm sóc => Mặc định là loại Lead khách hàng hiện hữu".

**Tài nguyên đã có trong file Excel khi tới lượt làm**: sheet "Dịch vụ" (danh mục + gói + giá cước + chiết khấu → nền cho catalog động và báo giá), sheet "Danh mục giải pháp CNTT" (7 nhóm; nhóm 7 "An toàn thông tin và bảo mật số"), sheet "Lead" (3 loại: Lead gia hạn / Lead KH mới / Lead bán chéo DV).
**Còn thiếu / phải hỏi user lúc đó**: token Zalo OA (ZNS) và cách tạo Zalo Group Bot; file mẫu báo giá; danh sách dịch vụ thuộc "nhóm CNTT/An toàn thông tin"; loại Lead nào trong 3 loại ứng với "khách hàng hiện hữu"; cách định nghĩa "thuê bao nằm trong điều kiện cảnh báo".

---

# PHẦN 9 — DANH SÁCH STT → NHIỆM VỤ (để leader đối chiếu cuối cùng)

| STT (cột A) | Nội dung rút gọn | Nhiệm vụ |
|---|---|---|
| 1 (dòng 2) | Không tự đổi pass | T5 |
| – (dòng 3) | Admin xóa record | T6 (khách), T7 (còn lại), T10 (đơn) |
| 2 | Admin sửa Lead | T1 |
| 3 | Không lùi bước, cần Admin duyệt | T1 |
| 4 | Bỏ cột Phường ở Lead | T1 |
| 5 | Chi tiết Kênh phát triển (Lead) | T1 |
| 6 | Trả trước theo tháng + "Theo hợp đồng" | T2 |
| 7 | Đơn hàng bỏ Phường | T2 |
| 8 | Đơn hàng chọn chi tiết kênh | T6 |
| 9 | Bắt buộc AM phát triển | T2 |
| 10 | Đơn nhiều dịch vụ + TOKEN | T8–T9 |
| 11 | 1 mã GD = 1 hợp đồng theo mẫu | T10 |
| 12 | Đề nghị thanh toán xem trước + PDF/DOC, số văn bản lazy | T2 (+T9 nhiều dòng) |
| 13 | Tiền có dấu chấm | T2 |
| 14 | Hoàn tất → theo dõi hoa hồng | T6 (+T5 nhãn) |
| 15 | Hoa hồng nhận / Còn lại | T5 |
| 16 | Khách: Team, bỏ Phường, Kênh bán con | T6 |
| 17 | Import khách (khách chưa test) | Không làm gì, chờ phản hồi |
| 18 | Chưa hiểu menu Dịch vụ & cảnh báo | T5 (khung giải thích) |
| 19 | Tách Dịch vụ/Cảnh báo, ZNS, báo giá, Lead CNTT | T11 (hoãn) |
| 19 (KPI) | Hướng dẫn sử dụng KPI | T5 |
| 20 | Email: định dạng + chữ ký | T4 |
| 21 | Email: cấu hình theo nhóm, ngày tự chỉnh | T4 |
| 22 | Nhân viên: mặc định đang hoạt động | T3 |
| 23 | Một nhân viên nhiều Phường | T3 |

---

# PHẦN 10 — LEADER: KIỂM TRA SAU MỖI ĐỢT

1. Chạy lại toàn bộ test backend **từng file một trên DB sạch** và Playwright API; sau đó UI e2e với `--workers=1`.
2. Mở FE local và **thao tác như người thật** theo từng STT của đợt (khách sẽ kiểm tra trên FE thật), đối chiếu từng dòng ở Phần 9.
3. Kiểm tra `git status`: không có file ngoài phạm vi, không có file tạm/ảnh/DB, không dấu vết AI (`grep -ri "claude\|anthropic\|co-authored" ` trên phần thay đổi).
4. Trình user: báo cáo từng nhiệm vụ + việc tồn đọng; **user duyệt rồi mới commit** (tách commit theo nhiệm vụ, message tiếng Anh), push `dev`, merge `main` và deploy bằng user `demo` (xem quy trình deploy trong memory dự án).
5. Việc cần chạy trên **server** sau đợt T2: cài LibreOffice cho xuất PDF (`sudo apt install -y libreoffice-writer`).
