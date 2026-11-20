"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Lắp Internet VNPT có mất phí hòa mạng không?",
    a: "Hiện VNPT đang miễn phí hòa mạng và khảo sát lắp đặt cho hầu hết các gói cước Internet cá nhân/gia đình. Chi tiết ưu đãi theo từng thời điểm sẽ được nhân viên tư vấn thông báo cụ thể.",
  },
  {
    q: "Giá cước đã bao gồm modem WiFi chưa?",
    a: "Các gói cước đều đã bao gồm modem WiFi băng tần kép tiêu chuẩn. Nếu cần mở rộng vùng phủ sóng, bạn có thể đăng ký thêm thiết bị WiFi Mesh theo gói Home Mesh Pro.",
  },
  {
    q: "Tôi có thể nâng cấp thêm WiFi Mesh không?",
    a: "Có. Bạn có thể đăng ký thêm 1 hoặc nhiều thiết bị WiFi Mesh cho gói cước hiện tại để mở rộng vùng phủ sóng, loại bỏ điểm chết WiFi trong nhà.",
  },
  {
    q: "Thời gian lắp đặt Internet VNPT là bao lâu?",
    a: "Thông thường từ 24-48 giờ kể từ khi xác nhận đăng ký, tuỳ khu vực và hạ tầng sẵn có. Kỹ thuật viên sẽ liên hệ hẹn lịch cụ thể trước khi đến lắp đặt.",
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-end justify-between border-l-4 border-vnpt pl-4">
        <h2 className="text-slate-800">Câu hỏi thường gặp (FAQ)</h2>
        <Link href="/lien-he" className="text-sm font-medium text-vnpt hover:underline">
          Xem tất cả câu hỏi →
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className="rounded-lg border border-slate-100 bg-white">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-slate-700"
              >
                {item.q}
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && <p className="px-4 pb-3.5 text-sm text-slate-500">{item.a}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
