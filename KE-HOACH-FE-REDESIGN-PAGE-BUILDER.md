# Kế hoạch redesign FE VNPT Nam Sài Gòn theo kiến trúc Section Registry (Page Builder tối giản)

> File này dành cho AI/dev khác thực hiện. Đọc hết 1 lượt trước khi code, **đặc biệt Mục 0 (quy tắc bắt buộc)**. Mọi quyết định kiến trúc đã được chốt với chủ dự án — không tự ý đổi hướng. Gặp tình huống thuộc Mục 0.7 thì dừng và hỏi.

## 0. QUY TẮC BẮT BUỘC (vi phạm điều nào → dừng lại và báo, không tự xử lý)

### 0.1 Nguồn sự thật & cấm bịa

Thứ tự ưu tiên khi các nguồn mâu thuẫn: **(1) ảnh design** trong `D:\du an  VNPT FE\Website_VNPT NSG\` → **(2) dữ liệu thật đang có trong code** (`content/category-products`, `content/audience-map.ts`, `content/internet-groups.ts`...) → **(3) file MD này**. Không có mức (4): không được tự nghĩ ra.

- Phải **mở và xem từng ảnh** (tool đọc ảnh) trước khi dựng trang tương ứng. Không dựng từ tên file, từ trí nhớ, hay từ "chắc trang này giống trang kia". Bám 100% ảnh: đúng section, đúng thứ tự, đúng thành phần, đúng số lượng item, đúng chữ. "Gần giống" = chưa xong.
- Chủ dự án đã từng bác bản dựng "generic" không bám ảnh. **Không tái dùng layout/style của project VNPT cũ** (`d:\Dự án VNPT`). Chỉ tái dùng component/data đã có trong repo này khi nó khớp ảnh.
- Nội dung nghiệp vụ (giá, số liệu, hotline, email, tên khách hàng, trích dẫn pháp lý/số nghị định, tên gói) chỉ được lấy từ: chữ **đọc rõ** trong ảnh, hoặc data đã có sẵn trong repo. **Cấm bịa** số liệu, giá, tên khách hàng, hotline, trích dẫn pháp lý. Chữ trong ảnh nhỏ/mờ → crop/zoom ảnh để đọc; vẫn không đọc được → hỏi, không đoán.
- Ảnh và data thật mâu thuẫn (vd ảnh ghi giá khác code): **giữ data thật cho các con số/giá**, theo ảnh cho bố cục và chữ marketing, và ghi mâu thuẫn vào báo cáo.
- Màu & font theo brief khách hàng đã chốt: nút CTA `#0A66C2` chữ trắng (hover `#084C94`); **trên nền tối nút phải đảo ngược** (nền trắng chữ xanh đậm hoặc outline trắng — không để nút xanh trên nền xanh đậm); heading Montserrat, body Inter; dùng token có sẵn trong `frontend/app/globals.css` (`--color-vnpt*`), không hard-code thêm mã màu mới. Cam `#f26522` chỉ dùng làm màu nhấn phụ.
- **Gotcha tên file tiếng Việt trên Windows**: gõ trực tiếp tên có dấu (vd `Hoá đơn điện tử.png`) vào Bash/PowerShell sẽ hỏng. Cách đúng: `Get-ChildItem` liệt kê, tham chiếu file qua chỉ số mảng / `.FullName`, copy sang thư mục tạm **ngoài** thư mục design với tên ASCII, rồi đọc bản copy. **Thư mục design là read-only**: không đổi tên, không xoá, không ghi thêm file vào đó.
- Thư mục `Website_VNPT NSG/` đang untracked trong git nên **không có trong worktree mới** — đọc ảnh bằng đường dẫn tuyệt đối ở thư mục gốc.

### 0.2 Phạm vi sửa (whitelist / blacklist)

**Được tạo/sửa (và chỉ những file này):**
- `frontend/components/page-builder/**`, `frontend/content/page-builder/**`, `frontend/lib/icon-map.ts` (mới) và các file test mới đi kèm.
- Route của 9 trang cần sửa + `frontend/app/page.tsx` + 3 route mới `frontend/app/san-pham/{vnpt-ioffice,vnpt-pharmacy,vnpt-bhxh}/page.tsx` (danh sách ở Mục 4).
- `frontend/components/layout/Header.tsx` (chỉ ở Task 6, chỉ phần `NAV`) và `Footer.tsx` (chỉ nếu cần đặt link Plugin & Công cụ).
- `frontend/package.json`: **chỉ** dòng `"test"` để thêm file test mới. Không đụng `dependencies`.

**Cấm đụng (kể cả "tiện tay sửa luôn"):**
- Toàn bộ `backend/`, `frontend/app/admin/**`, `frontend/app/cong-tac-vien/**`, `login`, `doi-mat-khau`, `ref`, `components/admin/**`, `components/ctv/**`.
- Các trang ngoài 12 ảnh: `/giai-phap/[doiTuong]`, `/dich-vu-cntt`, `/san-pham-vien-thong`, `/khuyen-mai`, `/tin-tuc`, `/khach-hang`, `/gioi-thieu`, `/lien-he`, `/tim-kiem`, và các component riêng của chúng (`components/dich-vu-cntt/*`, `components/san-pham-vien-thong/*`, `components/plugin-cong-cu/*`...). **Không sửa, không xoá** kể cả khi trang chủ không còn dùng (vd `FeaturedServices.tsx` đang được `/dich-vu-cntt` dùng).
- `components/layout/Shell.tsx`, `components/sections/LeadForm.tsx` (tái dùng nguyên trạng; hiện là form UI chưa gọi API — không tự nối API), `StatBar`, `PricingTable` (chỉ bọc, không sửa), `app/globals.css`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `.env*`, `deploy.sh`, toàn bộ `e2e/` (trừ thêm test mới; xem 0.4).
- **Giữ nguyên URL/slug mọi route hiện có** (đang được link và index). Không đổi slug, không xoá route — kể cả `/plugin-cong-cu` khi bỏ khỏi nav.
- Cần đụng file ngoài whitelist → **dừng hỏi**.

`Header`/`Footer` dùng chung cho mọi trang công khai. Sau khi sửa phải mở thủ công ≥ 6 trang (`/`, `/lien-he`, `/dich-vu-cntt`, `/san-pham-vien-thong`, `/cong-tac-vien`, `/khuyen-mai`) xác nhận vẫn render đúng, và xác nhận `/admin/...` + `/cong-tac-vien/dashboard/...` vẫn **không** có header marketing (do `Shell.tsx`).

### 0.3 An toàn git

- Chạy `git status` trước khi làm. Repo đang có thay đổi chưa commit **không phải của mình** (file bị xoá/sửa, và file untracked như `BAO-CAO-*.md`, `TIEP-THEO-*.md`, `HANDOFF-*.md`, `feedback L1.txt`, `Website_VNPT NSG/`...). **Không xoá/sửa/reset/stash/commit/add** các file đó.
- Làm trong **git worktree riêng** + **nhánh mới** (vd `feat/page-builder-redesign`), không làm trên nhánh đang checkout (`feat/lead-form-cleanup-and-table-filters`), không commit thẳng `main`/`dev`. Thư mục `.worktrees/` đã có sẵn trong repo, theo cùng cách đặt tên. Nhánh nền: kiểm `git log --oneline dev..<nhánh>` và **hỏi chủ dự án chọn nhánh nền** (mặc định `dev`) vì nhánh đang checkout có commit chưa nằm trong `dev`.
- Worktree mới chưa có `node_modules`: dùng `npm ci` (không phải `npm install`) trong `frontend/` của worktree. **`package-lock.json` không được xuất hiện trong diff.**
- Cấm: `git reset --hard`, `git clean`, `git checkout .`/`git restore .`, `git stash` đụng thay đổi của người khác, `push --force`, `--no-verify`, sửa git config, `git add -A`/`git add .` (chỉ `git add` đúng từng file của task), push/merge/tạo PR khi chưa được chủ dự án cho phép (commit local thì được).
- **Commit message: tiếng Anh, ngắn gọn, 1 dòng, chuẩn conventional.** **TUYỆT ĐỐI KHÔNG** thêm `Co-Authored-By`, "Generated with ... AI" hay bất kỳ dấu vết AI nào vào commit/PR/comment code/tài liệu — luật cứng của chủ dự án, ưu tiên cao hơn mặc định của công cụ.
- Trước mỗi commit: `git status` + `git diff --staged` — chỉ chứa file thuộc task; không có `.env`, `.next`, `node_modules`, ảnh tạm, `test-results`.

### 0.4 An toàn máy & môi trường

- Chỉ ghi file trong worktree và thư mục scratch/temp. Không ghi ra ngoài, không đụng cấu hình người dùng, không cài global, **không thêm dependency** (đã đủ `next`, `react`, `lucide-react`, `tailwindcss`, `tsx`, `@playwright/test`; cần thêm → hỏi).
- Không `rm -rf`/`Remove-Item -Recurse` bất cứ thứ gì không phải do chính mình tạo ra trong đợt này. Không đụng `node_modules`/`.next` của thư mục gốc người dùng.
- Không đụng `.env*`, DB, `backend/`, server production, PM2, `deploy.sh`; không chạy SSH/deploy.
- Máy có thể đang chạy sẵn dev server/backend (cổng 3005, 8099, 3004...). **Không kill process không do mình bật.** Dùng cổng trống (vd `npm run dev -- -p 3111`) và chỉ tắt đúng process mình bật.
- **E2E có rủi ro ghi dữ liệu thật**: `playwright.config.ts` trỏ vào backend (cổng 8099) và nhiều spec ghi DB (`admin-write-actions`, `e2e/api/*`, `rate-limits`...). **KHÔNG chạy cả suite `npm run test:e2e`** và không chạy spec cần backend/đăng nhập khi chưa được chủ dự án xác nhận DB backend đang trỏ là DB local dùng để test. Được chạy tự do: `npm test` (unit, không cần DB), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `e2e/public-layout.spec.ts` assert header công khai có link **"Sim số"**. Khi sửa nav phải giữ link này (trừ khi ảnh design bỏ nó → hỏi). Hai case đầu spec này không cần đăng nhập, có thể chạy riêng bằng `--grep`; case thứ 3 đăng nhập admin → không chạy.

### 0.5 Cấm làm đối phó / ẩu

- Cấm `// @ts-ignore`, `@ts-expect-error`, `eslint-disable`, `as any`, `as unknown as X` để lấp lỗi type (ngoại lệ duy nhất: 1 chỗ cast hẹp trong `registry.tsx` mô tả ở 2.2, kèm 1 dòng comment lý do).
- Cấm xoá/`skip`/`.only`/nới assertion của test hiện có cho xanh. Sửa test hiện có chỉ khi hành vi đổi là chủ đích của task, và nêu rõ trong báo cáo.
- Cấm stub rỗng, `TODO`, `lorem ipsum`, chữ giả kiểu "đang cập nhật", ảnh/số liệu giả để cho build qua.
- Cấm refactor lan, đổi tên hàng loạt, format lại file không liên quan, đổi version dependency, "cải tiến" thứ không được giao.
- Cấm báo "xong/chạy ổn" khi chưa chạy lệnh kiểm chứng; cấm dùng "chắc là/should work" thay cho bằng chứng.

### 0.6 Quy trình mỗi task & bằng chứng nghiệm thu

**Trước khi sửa bất cứ gì**, chạy baseline `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` và ghi lại kết quả. Lỗi có sẵn từ trước **không tự sửa**, chỉ báo.

Với mỗi trang (Task 3–6), theo đúng thứ tự:
1. Mở ảnh design → viết **section inventory**: liệt kê từ trên xuống từng khối (tên khối, bố cục, số item, chữ chính), cả desktop và mobile nếu ảnh có.
2. Đối chiếu inventory với registry: khối nào dùng section sẵn, khối nào cần section/biến thể mới — nêu rõ **trước khi** code.
3. Nếu là trang sửa: chụp ảnh baseline trang hiện tại để so trước–sau.
4. Code theo TDD (xem Mục 5).
5. Chạy `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` — cả 4 phải pass, **dán tóm tắt output**.
6. Mở trang bằng dev server (cổng trống) ở 1440px và 390px, chụp ảnh, đặt cạnh ảnh design, liệt kê **từng điểm lệch còn lại**. Không được ghi "giống 100%" khi chưa so từng khối. Console không có error/warning mới, không 404 ảnh/font.
7. Mở ≥ 3 trang không thuộc task xác nhận không hỏng.
8. Commit rồi mới sang task kế. Không gộp nhiều task vào 1 commit, không làm song song.

**Báo cáo cuối mỗi task** (ngắn): file đã tạo/sửa (từ `git diff --stat`), lệnh đã chạy + kết quả, ảnh so sánh, danh sách điểm lệch/chưa xác minh được, câu cần hỏi. Mục nào không có thì ghi "không".

### 0.7 Khi nào PHẢI dừng và hỏi (không tự quyết)

- Cần sửa file ngoài whitelist 0.2, thêm dependency, đổi route/slug, đổi schema backend/DB.
- Các ảnh design mâu thuẫn nhau hoặc mâu thuẫn data thật; chữ/số trong ảnh không đọc được.
- Test fail do thay đổi của mình mà không rõ lý do.
- `git status` có thay đổi lạ trong worktree khác với dự kiến.
- Một section vượt ~150 dòng hoặc cần > 3 biến thể (xem 2.4).
- Ảnh design thiếu/không mở được/không khớp tên trang.

## 1. Bối cảnh & lý do làm theo kiến trúc này

Khách hàng (VNPT Nam Sài Gòn) gửi 12 ảnh thiết kế FE mới + 1 ảnh mô tả cấu trúc "danh mục giải pháp" (7 nhóm, mỗi nhóm nhiều nhóm sản phẩm con, dạng accordion xổ ra). Họ không chắc chắn nội dung/sản phẩm sẽ cố định — sau này có thể đổi tên, thêm bớt sản phẩm, tạo trang mới mà **không muốn phải gọi dev code lại mỗi lần**.

Vì vậy **KHÔNG** build mỗi trang là 1 file hard-code JSX với mảng dữ liệu nhét cứng bên trong (cách cũ của codebase hiện tại). Thay vào đó:

- Mỗi trang = **1 danh sách section theo thứ tự**, lấy từ data (file content config giai đoạn này, lên admin CRUD ở giai đoạn sau).
- Mỗi loại section = **1 component dùng chung**, đăng ký vào "registry", nhận data qua props, không chứa nội dung cứng.
- Thêm/sửa nội dung = sửa data. Thêm **loại section hoàn toàn mới** (layout chưa từng có) = dev code thêm 1 component + đăng ký vào registry 1 lần duy nhất, dùng lại mãi mãi sau đó cho mọi trang.

Đây **không phải** admin CRUD tự do tuyệt đối — có giới hạn là tập hữu hạn các loại section. Admin CRUD (để người không biết code tự ghép trang) là **Giai đoạn 2**, ngoài phạm vi file này, chỉ cần kiến trúc code ở Giai đoạn 1 không cản trở việc nâng cấp lên đó sau này (xem mục 7).

## 2. Kiến trúc kỹ thuật

### 2.1. Data schema

Tạo file `frontend/content/page-builder/types.ts`:

```ts
import type { HeroProductData } from "@/components/page-builder/sections/HeroProductSection";
import type { FeatureGridData } from "@/components/page-builder/sections/FeatureGridSection";
// ... import type cho từng section đã build (CHỈ `import type`, tránh vòng lặp import)

/** Bảng ánh xạ: loại section -> shape data của nó. Thêm section mới = thêm 1 dòng ở đây. */
export interface SectionDataMap {
  "hero-product": HeroProductData;
  "feature-grid": FeatureGridData;
  // ... chỉ khai báo các section đã thực sự được build (xem Mục 3)
}

export type SectionType = keyof SectionDataMap;

/** Discriminated union: `type` quyết định kiểu của `data`, sai shape là lỗi compile. */
export type SectionBlock = {
  [K in SectionType]: {
    /** Duy nhất trong 1 trang, dùng làm React key. */
    id: string;
    type: K;
    data: SectionDataMap[K];
  };
}[SectionType];

export interface PageDefinition {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  sections: SectionBlock[];
}
```

Mỗi loại section tự định nghĩa interface data riêng + `export` nó từ file component của nó (ví dụ `HeroProductData` trong `HeroProductSection.tsx`), không gom hết vào 1 file type khổng lồ. Chỉ thêm vào `SectionDataMap` những section đã thực sự build — **không khai báo trước** các section chưa có (vd `solution-comparison-table`, xem Mục 3.2).

### 2.2. Section Registry + PageRenderer

Tạo `frontend/components/page-builder/registry.tsx`:

```tsx
import type { ComponentType } from "react";
import type { SectionBlock, SectionDataMap, SectionType } from "@/content/page-builder/types";
import HeroProductSection from "./sections/HeroProductSection";
import FeatureGridSection from "./sections/FeatureGridSection";
// ... import các section đã build

/** Mỗi key bắt buộc có component nhận ĐÚNG shape data của nó — thiếu key/sai props là lỗi compile. */
const SECTION_REGISTRY: { [K in SectionType]: ComponentType<SectionDataMap[K]> } = {
  "hero-product": HeroProductSection,
  "feature-grid": FeatureGridSection,
  // ...
};

export function PageRenderer({ sections }: { sections: SectionBlock[] }) {
  return (
    <>
      {sections.map((section) => {
        // Cast hẹp DUY NHẤT được phép: TS không thu hẹp được union tương quan type/data qua index.
        const Component = SECTION_REGISTRY[section.type] as ComponentType<SectionBlock["data"]> | undefined;
        if (!Component) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[PageRenderer] Không tìm thấy section type "${section.type}"`);
          }
          return null;
        }
        return <Component key={section.id} {...section.data} />;
      })}
    </>
  );
}
```

Không throw error khi gặp `type` lạ ở runtime (data sau này có thể đến từ DB/CMS) — chỉ warn ở môi trường dev + bỏ qua, để lỗi data không sập cả trang production. Đây là ngoại lệ duy nhất cho quy tắc cấm cast ở Mục 0.5; nếu cast này không biên dịch được, **dừng hỏi**, đừng thêm `any`.

### 2.3. Cấu trúc thư mục

```
frontend/
  components/page-builder/
    registry.tsx
    sections/
      HeroProductSection.tsx
      FeatureGridSection.tsx
      UseCaseHubSection.tsx
      PricingTableSection.tsx
      ProcessStepsSection.tsx
      VideoGuideGridSection.tsx
      StatBarSection.tsx          (wrap lại StatBar hiện có nếu cần đổi props shape)
      CustomerLogosSection.tsx
      FaqPromoSupportSection.tsx
      CategoryAccordionSection.tsx
      CtaBannerSection.tsx
      PartnerLogosSection.tsx     (wrap PartnerLogos hiện có)
      SolutionWorkflowSection.tsx
      SolutionComparisonTableSection.tsx
  content/page-builder/
    types.ts
    pages/
      chu-ky-so.ts
      hop-dong-dien-tu.ts
      hoa-don-thue.ts
      cloud-idc.ts
      internet-ca-nhan-gia-dinh.ts
      internet-doanh-nghiep.ts
      bang-rong-co-dinh.ts
      vnpt-ioffice.ts
      vnpt-pharmacy.ts
      vnpt-bhxh.ts
      homepage-services.ts        (data cho CategoryAccordion ở trang chủ)
```

Mỗi trang `app/.../page.tsx` lúc này chỉ còn:

```tsx
import type { Metadata } from "next";
import { PageRenderer } from "@/components/page-builder/registry";
import { chuKySoPage } from "@/content/page-builder/pages/chu-ky-so";

export const metadata: Metadata = {
  title: chuKySoPage.metaTitle,
  description: chuKySoPage.metaDescription,
};

export default function ChuKySoPage() {
  return <PageRenderer sections={chuKySoPage.sections} />;
}
```

### 2.4. Nguyên tắc code cho từng section component

- Component **không fetch data, không biết route/slug nào đang gọi nó** — chỉ nhận props và render. Giữ component "ngu" (dumb/presentational), toàn bộ logic nằm ở data.
- Không hard-code text/màu/icon theo 1 sản phẩm cụ thể bên trong section — nếu thấy mình đang viết `if (slug === "chu-ky-so")` bên trong section dùng chung, nghĩa là thiết kế data sai, phải sửa data shape chứ không rẽ nhánh trong component.
- Icon: dùng tên icon dạng string từ `lucide-react` (vd `"FileSignature"`) trong data, map sang component icon qua 1 bảng tra cứu chung `frontend/lib/icon-map.ts` — không serialize component React trực tiếp vào file data (giữ data là JSON-serializable, chuẩn bị cho giai đoạn 2 khi data chuyển vào DB/CMS). `icon-map.ts` phải **import có tên từng icon thực sự dùng** (`import { FileSignature, ... } from "lucide-react"`), **không** `import * as icons` (làm phình bundle). Kiểu key là union các tên icon đã khai báo (`IconName`), để tên icon sai trong data là lỗi compile.
- Mỗi section file ≤ ~150 dòng. Nếu 1 section cần nhiều biến thể UI quá khác nhau → tách thành 2 section type riêng, đừng nhồi `variant` prop rẽ nhánh phức tạp.
- Giữ nguyên các component đã tốt sẵn (`LeadForm`, `Breadcrumb`, `PricingTable`, `StatBar`, `PartnerLogos`) — bọc (wrap) chúng trong section mới nếu props shape chưa khớp, không viết lại từ đầu.

## 3. Danh sách section cần build

### 3.1. Lớp 1 — Section dùng chung (generic, dùng cho nhiều loại trang)

| Section type | Mô tả | Dùng ở ảnh/trang nào |
|---|---|---|
| `hero-product` | Hero lớn: tiêu đề, mô tả, danh sách check, 2 nút CTA, ảnh + badge nổi | Tất cả trang sản phẩm (Chữ ký số, eContract, Hóa đơn, Cloud, Internet, iOffice, Pharmacy, BHXH...) |
| `feature-grid` | Lưới icon + nhãn + mô tả ngắn (dùng cho "Dành cho ai", "Tại sao chọn") | Chữ ký số, và hầu hết trang sản phẩm khác |
| `use-case-hub` | Icon trung tâm (tên sản phẩm) + vòng quanh là các icon use-case | Chữ ký số ("SmartCA dùng để làm gì") |
| `pricing-table-section` | Nhiều cột bảng giá theo nhóm đối tượng | Chữ ký số, Internet, Cloud |
| `process-steps` | Các bước quy trình đăng ký/sử dụng, đánh số | Chữ ký số và các trang có quy trình đăng ký |
| `video-guide-grid` | Lưới thumbnail video hướng dẫn | Chữ ký số và trang có hướng dẫn sử dụng |
| `stat-bar` | Thanh số liệu thống kê (wrap `StatBar` hiện có) | Hầu hết mọi trang sản phẩm |
| `customer-logos` | Lưới logo khách hàng tiêu biểu | Hầu hết mọi trang sản phẩm |
| `faq-promo-support` | 3 cột: FAQ / ưu đãi CTA / hỗ trợ liên hệ | Hầu hết mọi trang sản phẩm |
| `category-accordion` | Danh sách category xổ ra nhóm sản phẩm con (đúng ảnh sitemap 7 nhóm) | Trang chủ (khối "Dịch vụ & Giải pháp CNTT"), có thể dùng lại cho `/dich-vu-cntt` |
| `cta-banner` | Banner CTA lớn cuối trang | Mọi trang |
| `partner-logos` | Lưới logo đối tác (wrap `PartnerLogos` hiện có) | `/dich-vu-cntt`, có thể dùng thêm ở trang khác |

### 3.2. Lớp 2 — Section riêng cho nhóm "Giải pháp" theo ngành

| Section type | Mô tả | Dùng ở |
|---|---|---|
| `solution-workflow` | Sơ đồ luồng/quy trình giải pháp đặc thù ngành (vd luồng khám chữa bệnh — Pharmacy, luồng xác lập hồ sơ BHXH) | VNPT Pharmacy, VNPT-BHXH |
| `solution-comparison-table` | Bảng so sánh gói/tính năng theo ngành | Dự phòng cho trang giải pháp có nhiều gói khác nhau, chưa chắc dùng ngay — chỉ build khi task thực tế cần (xem mục review ở cuối) |

⚠️ Không build `solution-comparison-table` trước khi có task cụ thể cần — tránh code thừa (YAGNI). Chỉ liệt kê sẵn tên + vị trí dự kiến trong registry.

## 4. Mapping 12 trang thiết kế → việc cần làm

| # | Ảnh thiết kế | Route | Việc làm | Section cần dùng |
|---|---|---|---|---|
| 1 | Home_2 | `/` | **Sửa** — thay khối "Dịch vụ & Giải pháp CNTT" cũ (hard-code trong component riêng) bằng `category-accordion` đọc từ `content/page-builder/pages/homepage-services.ts`, data 7 nhóm giống ảnh sitemap (bao gồm cả iOffice, Pharmacy, BHXH, mOffice) | `category-accordion` |
| 2 | Chữ ký số | `/san-pham/chu-ky-so` | **Sửa** — refactor toàn bộ `page.tsx` hiện tại (đang hard-code ~10 mảng dữ liệu trong file) sang `PageRenderer` + data file | `hero-product`, `feature-grid` ×2, `use-case-hub`, `pricing-table-section`, `process-steps`, `video-guide-grid`, `stat-bar`, `customer-logos`, `faq-promo-support` |
| 3 | eContract | `/san-pham/hop-dong-dien-tu` | **Sửa**, refactor tương tự #2 (không có use-case-hub nếu ảnh không có khối đó — kiểm tra ảnh trước khi build) | tương tự #2, bỏ bớt section ảnh không có |
| 4 | Hóa đơn điện tử | `/san-pham/hoa-don-thue` | **Sửa** — refactor + đổi `metaTitle` từ "Hóa đơn - Thuế" → "Hóa đơn điện tử VNPT" | tương tự #2 |
| 5 | Plugin & Công cụ | `/plugin-cong-cu` | **Sửa nhẹ** — trang này đã có cấu trúc section riêng khá rõ ràng (`HeroSection`, `OnlineTools`, `DownloadCatalog`, `QuickAccess`, `TechSupport`), có thể giữ nguyên code hiện tại nếu không lệch design, chỉ chỉnh UI theo ảnh. Không bắt buộc refactor sang registry trong đợt này nếu tốn effort không cần thiết | — |
| 6 | Internet Cá nhân | `/san-pham/internet-ca-nhan-gia-dinh` | **Sửa**, refactor sang registry | `hero-product`, `feature-grid`, `pricing-table-section`, `stat-bar`, `faq-promo-support`, ... (chốt theo ảnh thật) |
| 7 | Internet Doanh nghiệp | `/san-pham/internet-doanh-nghiep` | **Sửa**, refactor tương tự #6 | tương tự #6 |
| 8 | Internet VNPT (hub) | `/san-pham/bang-rong-co-dinh` | **Sửa**, refactor sang registry, đóng vai trò trang hub dẫn tới #6 #7 | `hero-product`, `category-accordion` hoặc `feature-grid` tuỳ ảnh |
| 9 | VNPT Smart Cloud | `/san-pham/cloud-idc` | **Sửa** — refactor + đổi `metaTitle` "VNPT Cloud & Data Center" → "VNPT Smart Cloud" | tương tự #2 |
| 10 | VNPT iOffice | **Chưa có route** | **Tạo mới** — `app/san-pham/vnpt-ioffice/page.tsx` + data file + thêm entry vào `Header.tsx` NAV (dropdown "Dịch vụ CNTT") + thêm card vào `homepage-services.ts` | `hero-product`, `feature-grid`, `pricing-table-section` (nếu có gói), `stat-bar`, `faq-promo-support` |
| 11 | VNPT Pharmacy | **Chưa có route** | **Tạo mới** — `app/san-pham/vnpt-pharmacy/page.tsx` tương tự #10. Cân nhắc dùng thêm `solution-workflow` nếu ảnh có sơ đồ luồng quy trình | `hero-product`, `feature-grid`, `solution-workflow`?, `faq-promo-support` |
| 12 | VNPT-BHXH | **Chưa có route** | **Tạo mới** — `app/san-pham/vnpt-bhxh/page.tsx` tương tự #10/#11 | `hero-product`, `feature-grid`, `solution-workflow`?, `faq-promo-support` |

### Các điểm đã chốt với chủ dự án (không cần hỏi lại nữa)

1. **Ảnh sitemap 7 nhóm giải pháp theo ngành** (Doanh nghiệp / Chuyển đổi số / Giáo dục số / Y tế số / Nông nghiệp số / Hạ tầng số & Viễn thông / An toàn thông tin) — đây **chỉ là tầm nhìn/roadmap tương lai**, KHÔNG phải yêu cầu làm trong đợt này. **Không đụng vào `/giai-phap/[doiTuong]` hiện tại** (vẫn giữ nguyên chia theo đối tượng khách hàng), **không build catalog lồng nhóm/đếm số lượng** theo ảnh đó. Kiến trúc Section Registry ở file này đã đủ linh hoạt để mở rộng catalog này sau nếu họ quyết định làm thật — không cần chuẩn bị gì thêm ngoài việc tuân thủ đúng mục 2.
2. **"mOffice - Quản lý văn bản"**: KHÔNG tạo route riêng. Chỉ là **1 item trong `feature-grid`/card giới thiệu nằm trong trang VNPT iOffice** (task #6, mục 5) — xem như 1 tính năng/module của iOffice, không phải sản phẩm độc lập.
3. **Nav chuẩn chốt theo ảnh Home_2**: menu chính có mục **"Hỗ trợ"**, **bỏ "Plugin & Công cụ" khỏi menu chính** (trang `/plugin-cong-cu` vẫn giữ nguyên, chỉ không còn link trực tiếp trên nav — có thể đặt trong footer hoặc dẫn link từ trang con khác, không xoá route).

## 5. Thứ tự thực hiện (TDD, mỗi task 1 commit)

> Coding convention dự án: tiếng Việt trong UI/copy, tiếng Anh trong tên biến/hàm/commit message. **Hạ tầng test thực tế** (đã kiểm tra): `frontend/package.json` chỉ có `npm test` = `tsx --test <file...>` (node:test, ví dụ mẫu `content/category-map.test.ts`, `lib/table-filters.test.ts`) và Playwright e2e (cần backend + DB, xem 0.4 — **không chạy**). **Không có** Jest/Vitest/React Testing Library và **không được thêm**. Test component = `react-dom/server` `renderToStaticMarkup` chạy bằng `tsx --test`; thêm đường dẫn file test mới vào dòng `"test"` trong `package.json` (đây là thay đổi `package.json` duy nhất được phép). Mọi task phải làm theo quy trình Mục 0.6 (baseline → inventory → code → 4 lệnh kiểm → so ảnh → commit → báo cáo).

### Task 0 — Chuẩn bị (không commit code)
- Tạo worktree + nhánh mới theo 0.3 (hỏi chủ dự án nhánh nền), `npm ci` trong `frontend/` của worktree.
- Chạy baseline `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, ghi kết quả (lỗi có sẵn từ trước chỉ báo, không sửa).
- Mở **cả 12 ảnh** design (xem gotcha tên file 0.1) và viết section inventory sơ bộ cho từng trang; đối chiếu với bảng Mục 4. **Bảng Mục 4 là dự đoán, ảnh mới là sự thật**: chỗ nào lệch thì báo chủ dự án trước khi code.
- Báo cáo: kết quả baseline + inventory + các điểm lệch với bảng Mục 4.

### Task 1 — Dựng khung Page Builder (chưa đổi UI nào)
- Tạo `content/page-builder/types.ts`, `components/page-builder/registry.tsx`, `lib/icon-map.ts` (mới rỗng/tối thiểu, mở rộng dần theo section).
- Việc đầu tiên của task: chạy thử 1 test `.tsx` tối thiểu (render 1 `<div/>` bằng `renderToStaticMarkup`, import qua alias `@/`) để xác nhận `tsx --test` chạy được (tsconfig đã có `jsx: react-jsx` và `paths: @/*`). Nếu không chạy được thì **dừng hỏi**, không sửa `tsconfig`, không thêm thư viện test.
- Test (`components/page-builder/registry.test.tsx`, chạy bằng `tsx --test`): (a) `PageRenderer` render đúng component theo `type`, theo đúng thứ tự mảng; (b) gặp `type` lạ thì **không throw** và không render gì cho block đó; (c) 2 block cùng `type` vẫn render đủ (key theo `id`).
- Test tính toàn vẹn data (`content/page-builder/pages.test.ts`): duyệt mọi `PageDefinition` đã có, assert `id` section duy nhất trong từng trang, `metaTitle`/`metaDescription` không rỗng, mọi tên icon dùng trong data có trong `icon-map`. File này mở rộng dần mỗi khi thêm trang.
- Commit: `feat(page-builder): add section registry and page renderer`

### Task 2 — Section `hero-product` + `feature-grid` + `stat-bar` (wrap) + `faq-promo-support`
- Build 4 section hay lặp lại nhất trước, vì chúng dùng được ngay cho task refactor trang đầu tiên.
- Test: mỗi section 1 test `renderToStaticMarkup` với data mẫu, assert các chuỗi/phần tử chính xuất hiện (số item, tiêu đề), và assert **không** render khối tuỳ chọn khi data không có (vd không có ảnh → không có thẻ `<img>`). Không dùng snapshot cứng (dễ vỡ, dễ bị "update snapshot" cho xanh).
- Commit: `feat(page-builder): add hero-product, feature-grid, stat-bar, faq-promo-support sections`

### Task 3 — Refactor trang Chữ ký số (`/san-pham/chu-ky-so`) sang Page Builder
- Đây là trang pilot — làm xong task này mới tiếp tục build các section còn thiếu (`use-case-hub`, `pricing-table-section`, `process-steps`, `video-guide-grid`, `customer-logos`), vì lúc này mới biết chính xác props cần gì.
- Đây vừa là refactor cấu trúc vừa là **đổi giao diện theo ảnh design mới** (chủ dự án: "trang nào có rồi thì thay bằng design"). Quy tắc: **bố cục/thứ tự khối/chữ marketing theo ảnh**; **con số, giá, bảng giá lấy từ data thật đã có** (vd `getCategoryProducts("chu-ky-so")` và `PricingTable` — giữ nguồn data này, **không chép lại/bịa giá**). Nội dung cũ chỉ giữ khi ảnh mới cũng có nội dung đó; ảnh không có thì bỏ, không "giữ cho chắc". Ghi lại trong báo cáo khối nào bị bỏ/thêm so với bản cũ.
- Chụp ảnh baseline trang cũ trước khi sửa (0.6 bước 3) để so trước–sau.
- Test: test tính toàn vẹn data của trang này (thêm vào `pages.test.ts`) + render smoke bằng `renderToStaticMarkup` (trang chứa đủ các `h1`/`h2` theo inventory) + kiểm thủ công bằng dev server 1440px/390px (0.6 bước 6). **Không dùng e2e cần backend.**
- Commit: `refactor(page-builder): migrate chu-ky-so page to section registry`

### Task 4 — Refactor các trang sản phẩm còn lại (#3–#9 trong bảng mục 4)
- Mỗi trang 1 commit riêng, theo thứ tự bảng mục 4.
- Trang nào có section mới chưa từng build (vd ảnh thiết kế xuất hiện 1 khối khác hẳn) → build section đó trước, review lại xem có tái dùng được cho trang khác không trước khi quyết định tên/props cuối cùng.
- Commit mẫu: `refactor(page-builder): migrate hoa-don-thue page to section registry`, kèm sửa title riêng: `fix(san-pham): correct hoa-don-thue page title to match new design`

### Task 5 — Section `category-accordion` + sửa trang chủ
- Scope: chỉ danh sách **phẳng 7 card sản phẩm** đúng như khối "Dịch vụ & Giải pháp CNTT" trên ảnh Home_2 thực tế hiển thị (Chữ ký số, Hoá đơn điện tử, Hợp đồng điện tử, BHXH, VNPT Pharmacy, iOffice, mOffice) — **KHÔNG** phải catalog lồng nhóm/đếm số lượng theo ảnh sitemap 7 ngành (ảnh đó là roadmap tương lai, xem mục 4). `category-accordion` ở đây thực chất dùng như 1 lưới card có thể bấm, không cần cơ chế xổ/accordion lồng nhiều cấp.
- `mOffice` trong data này **link thẳng tới trang VNPT iOffice** (anchor tới phần giới thiệu mOffice trong trang đó), không có route riêng.
- `app/page.tsx` chưa được rà trong bản kế hoạch này. Việc đầu tiên: **đối chiếu TOÀN BỘ ảnh Home_2 với trang chủ hiện tại** (hero, các khối còn lại, không chỉ khối dịch vụ), liệt kê chỗ lệch, báo trước khi sửa. Chỉ sửa trong `app/page.tsx` và component của riêng trang chủ.
- **Không sửa/xoá `components/dich-vu-cntt/*`** (`FeaturedServices.tsx`...) dù trang chủ không còn dùng — `/dich-vu-cntt` vẫn dùng (0.2).
- Commit: `feat(page-builder): add category-accordion section`, `refactor(home): replace featured services block with category-accordion section`

### Task 6 — Tạo 3 trang mới: iOffice, Pharmacy, BHXH + sửa Nav
- Tạo 3 route: `vnpt-ioffice`, `vnpt-pharmacy`, `vnpt-bhxh` — mỗi trang: route + data file + thêm entry vào `homepage-services.ts` (Task 5). Nội dung theo ảnh tương ứng, cấm bịa giá/số liệu (0.1); phần ảnh có mà repo chưa có data thật thì dùng đúng chữ trong ảnh, không thêm gì ngoài ảnh.
- Nav: **theo đúng ảnh Home_2** cho các mục hiển thị trên thanh menu. Dropdown con không thấy được trong ảnh tĩnh → mặc định thêm 3 link mới vào dropdown "Dịch vụ CNTT" hiện có, và **ghi rõ điều này trong báo cáo** để chủ dự án xác nhận. Giữ link "Sim số" (`e2e/public-layout.spec.ts` đang kiểm tra, xem 0.4). Không đổi/xoá `/dich-vu-cntt` và các link khác không có trong yêu cầu.
- Trang `vnpt-ioffice`: thêm 1 khối `feature-grid` giới thiệu mOffice như 1 module/tính năng của iOffice (không phải trang riêng).
- Sửa `Header.tsx` NAV theo nav chuẩn đã chốt (mục 4): thêm mục **"Hỗ trợ"** vào menu chính, **bỏ "Plugin & Công cụ"** khỏi menu chính (giữ nguyên route `/plugin-cong-cu`, chỉ không hiện trên nav — có thể để trong Footer).
- Mỗi việc 1 commit: `feat(san-pham): add vnpt-ioffice page`, `feat(san-pham): add vnpt-pharmacy page`, `feat(san-pham): add vnpt-bhxh page`, `refactor(nav): update main nav to match new design (add Ho tro, remove Plugin & Cong cu)`

### Task 7 — Dọn dẹp
- Chỉ xoá thứ **do chính các task trước làm cho thành mã chết**: mảng dữ liệu cũ trong các `page.tsx` đã refactor, import thừa. Trước khi xoá bất kỳ file/component nào: `Grep` toàn repo (`frontend/` và `backend/`) chứng minh **0 chỗ import**, ghi kết quả vào báo cáo. Component nằm trong danh sách cấm đụng ở 0.2 (vd `FeaturedServices.tsx`, `components/dich-vu-cntt/*`) **không được xoá** dù trang chủ không còn dùng.
- Không chạy cả suite e2e (0.4). Thay vào đó: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` đều pass, và mở thủ công các trang ngoài phạm vi (`/`, `/dich-vu-cntt`, `/san-pham-vien-thong`, `/plugin-cong-cu`, `/giai-phap/ca-nhan`, `/lien-he`, `/khuyen-mai`) xác nhận không hỏng. Nếu muốn chạy e2e có backend → xin phép chủ dự án trước.
- Commit: `chore(page-builder): remove dead code after section registry migration`

## 6. Review focus (rà lại trước khi coi là xong)

- [ ] Mọi section component không có logic rẽ nhánh theo slug/sản phẩm cụ thể.
- [ ] Mọi data file là plain object/array JSON-serializable (icon dạng string, không import component React vào data).
- [ ] Nav (`Header.tsx`) phản ánh đúng 3 trang mới + đúng 1 bản chuẩn đã chốt ở câu hỏi #3 mục 4.
- [ ] `homepage-services.ts` chứa đủ 7 nhóm giống ảnh sitemap, bao gồm cả 3 sản phẩm mới.
- [ ] Không còn trang nào trong 12 ảnh bị bỏ sót: đối chiếu lại danh sách 12 ảnh gốc với route trước khi đóng Task 7.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` đều pass (so với baseline Task 0, không phát sinh lỗi mới).
- [ ] Với từng trang: có ảnh so sánh design vs bản dựng ở 1440px và 390px kèm danh sách điểm lệch còn lại (không có câu "giống 100%" nếu chưa so từng khối).
- [ ] `git diff <nhánh nền>...HEAD --stat` chỉ chứa file thuộc whitelist 0.2; không có `package-lock.json`, `.env*`, `backend/`, `e2e/` (trừ test mới), file ảnh tạm.
- [ ] Không có `@ts-ignore`, `eslint-disable`, `as any`, `test.skip`, `TODO`, chữ giả trong diff (`git diff ... | grep` kiểm tra).
- [ ] Commit message đều tiếng Anh, 1 dòng, **không** có `Co-Authored-By`/dấu vết AI (`git log --format=%B` kiểm tra).
- [ ] Không còn process dev server/cổng nào do mình bật còn chạy; thư mục `Website_VNPT NSG/` nguyên vẹn 12 file.
- [ ] Tất cả `/admin/**`, `/cong-tac-vien/dashboard/**` không bị ảnh hưởng (không có header marketing, không đổi hành vi).

## 7. Chuẩn bị cho Giai đoạn 2 (admin CRUD — KHÔNG làm trong phạm vi file này)

Chỉ cần lưu ý khi code Giai đoạn 1 để không phải đập đi xây lại:
- `PageDefinition`/`SectionBlock` phải là shape có thể serialize thẳng ra JSON/lưu DB (đã đảm bảo ở mục 2.1, 2.4).
- `SECTION_REGISTRY` là 1 bảng tra cứu đơn — sau này admin CRUD chỉ cần biết danh sách `SectionType` hợp lệ để hiển thị dropdown "chọn loại section", không cần đổi gì ở `PageRenderer`.
- Khi làm Giai đoạn 2, data các trang sẽ chuyển từ file `.ts` tĩnh sang bảng trong DB (giống cấu trúc `PageDefinition`), `PageRenderer` giữ nguyên không đổi.
