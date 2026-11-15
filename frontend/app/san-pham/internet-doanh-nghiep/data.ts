// Dữ liệu riêng cho trang Internet Doanh nghiệp, khai báo tay theo đúng ảnh design
// (Website_VNPT NSG/VNPT Internet doanh nghiệp.png). Không dùng chung content/internet-packages
// vì ảnh design có cấu trúc gói cước/section khác hẳn template InternetLanding.

export type BizPackage = {
  code: string;
  name: string;
  desc: string;
  features: string[];
  price: string;
  priceSuffix?: string;
  cta: string;
  featured?: boolean;
};

export const PACKAGES: BizPackage[] = [
  {
    code: "Business 200",
    name: "Business 200",
    desc: "Phù hợp văn phòng, doanh nghiệp nhỏ",
    features: ["Tốc độ 200 Mbps", "Hỗ trợ IP tĩnh (tùy chọn)", "Đảm bảo ổn định, bảo mật"],
    price: "399.000đ",
    priceSuffix: "/ tháng",
    cta: "Đăng ký ngay",
  },
  {
    code: "Business 300",
    name: "Business 300",
    desc: "Phù hợp doanh nghiệp vừa",
    features: ["Tốc độ 300 Mbps", "Hỗ trợ IP tĩnh (tùy chọn)", "Ưu tiên băng thông, ổn định cao"],
    price: "599.000đ",
    priceSuffix: "/ tháng",
    cta: "Đăng ký ngay",
    featured: true,
  },
  {
    code: "Business 500",
    name: "Business 500",
    desc: "Phù hợp doanh nghiệp lớn",
    features: ["Tốc độ 500 Mbps", "Hỗ trợ IP tĩnh (tùy chọn)", "Đáp ứng nhiều thiết bị"],
    price: "999.000đ",
    priceSuffix: "/ tháng",
    cta: "Đăng ký ngay",
  },
  {
    code: "Business 1000",
    name: "Business 1000",
    desc: "Doanh nghiệp có nhu cầu cao",
    features: ["Tốc độ 1 Gbps", "IP tĩnh, ưu tiên băng thông", "SLA & hỗ trợ kỹ thuật 24/7"],
    price: "Liên hệ báo giá",
    cta: "Nhận tư vấn",
  },
];

export const OTHER_PACKAGES_TABLE = {
  columns: ["Gói cước", "Tốc độ Internet", "IP tĩnh", "Đối tượng / Nhu cầu", "Giá cước / tháng"],
  rows: [
    ["Business 100", "100 Mbps", "Tùy chọn", "Văn phòng nhỏ, cửa hàng", "299.000đ"],
    ["Business 200+", "200 Mbps", "Tùy chọn", "Doanh nghiệp, chuỗi cửa hàng", "449.000đ"],
    ["Business 300+", "300 Mbps", "Tùy chọn", "Doanh nghiệp vừa, nhiều thiết bị", "699.000đ"],
  ],
};

export const HERO_HIGHLIGHTS = [
  "Đường truyền ổn định",
  "Băng thông linh hoạt",
  "Kết nối đa chi nhánh",
  "Bảo mật, IP tĩnh",
  "Hỗ trợ kỹ thuật 24/7",
];

export const STATIC_IP_BOXES = [
  {
    title: "Thuê IP tĩnh riêng",
    features: ["IP công cộng cố định", "Linh hoạt theo nhu cầu"],
    cta: "Nhận báo giá",
  },
  {
    title: "Internet + IP tĩnh",
    features: ["Đường truyền ổn định", "Kèm IP tĩnh theo gói"],
    cta: "Tư vấn ngay",
  },
];

export const NETWORK_SERVICES = [
  {
    name: "MetroNet",
    desc: "Kết nối mạng nội bộ giữa các địa điểm trong cùng khu vực đô thị.",
    features: ["Kết nối đa điểm, tốc độ cao", "Độ trễ thấp, ổn định", "Quản lý tập trung, an toàn"],
    cta: "Nhận báo giá MetroNet",
  },
  {
    name: "MegaWAN",
    desc: "Mạng riêng doanh nghiệp (MPLS VPN) kết nối nhiều chi nhánh toàn quốc.",
    features: ["Kết nối nhiều chi nhánh", "Bảo mật, phân tách dữ liệu", "Linh hoạt mở rộng, quản trị dễ dàng"],
    cta: "Nhận báo giá MegaWAN",
  },
  {
    name: "Leased Line",
    desc: "Đường truyền Internet chuyên biệt băng thông lớn, ổn định và an toàn.",
    features: ["Băng thông cam kết (SLA)", "Độ ổn định và bảo mật cao", "Đáp ứng hệ thống quan trọng"],
    cta: "Nhận báo giá Leased Line",
  },
];

export const REASONS = [
  { title: "Hạ tầng hiện đại, ổn định" },
  { title: "An toàn, bảo mật dữ liệu" },
  { title: "Hỗ trợ kỹ thuật 24/7" },
  { title: "Giải pháp linh hoạt, phù hợp mọi quy mô" },
];

export const STEPS = [
  { step: 1, title: "Tiếp nhận nhu cầu & tư vấn giải pháp" },
  { step: 2, title: "Khảo sát hạ tầng" },
  { step: 3, title: "Báo giá & ký hợp đồng" },
  { step: 4, title: "Triển khai, nghiệm thu & bàn giao" },
];

export const FAQS = [
  {
    q: "IP tĩnh là gì? Doanh nghiệp có nên sử dụng không?",
    a: "IP tĩnh là địa chỉ IP công cộng cố định, không thay đổi theo thời gian. Doanh nghiệp có hệ thống máy chủ, camera, VPN hoặc cần truy cập từ xa nên sử dụng IP tĩnh để đảm bảo kết nối ổn định và dễ quản lý.",
  },
  {
    q: "Leased Line phù hợp với những doanh nghiệp nào?",
    a: "Leased Line phù hợp với doanh nghiệp cần băng thông cam kết (SLA) riêng biệt, không chia sẻ với khách hàng khác, thường dùng cho hệ thống quan trọng, trung tâm dữ liệu, ngân hàng, hoặc doanh nghiệp quy mô lớn.",
  },
  {
    q: "MetroNet và MegaWAN khác nhau như thế nào?",
    a: "MetroNet kết nối các địa điểm trong cùng khu vực đô thị với độ trễ thấp. MegaWAN (MPLS VPN) kết nối nhiều chi nhánh trên phạm vi toàn quốc, phù hợp doanh nghiệp có hệ thống chi nhánh phân tán nhiều tỉnh thành.",
  },
  {
    q: "Thời gian triển khai dịch vụ là bao lâu?",
    a: "Sau khi khảo sát hạ tầng và ký hợp đồng, thời gian triển khai thông thường từ 3-7 ngày làm việc tùy khu vực và loại hình dịch vụ đăng ký.",
  },
];
