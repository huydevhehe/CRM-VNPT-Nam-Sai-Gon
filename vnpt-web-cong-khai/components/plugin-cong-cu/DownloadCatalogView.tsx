"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileCog, FileText, Info, Puzzle, Usb } from "lucide-react";

const DOC_BADGES = new Set(["PDF", "PPTX", "DOCX"]);

import { SMARTCA_BASE_URL } from "@/content/plugin-tools";
import DownloadRequestModal, {
  type DownloadableDoc,
} from "@/components/plugin-cong-cu/DownloadRequestModal";

type ToolItem = {
  label: string;
  path: string;
  badge: string;
  meta: string;
};

type ToolGroup = {
  icon: typeof Puzzle;
  title: string;
  desc: string;
  footerVariant: "direct" | "requireInfo";
  items: ToolItem[];
};

const GROUPS: ToolGroup[] = [
  {
    icon: Puzzle,
    title: "Plugin ký số",
    desc: "Cài đặt plugin để sử dụng dịch vụ Chữ ký số VNPT-CA hiệu quả trên các hệ điều hành.",
    footerVariant: "direct",
    items: [
      {
        label: "VNPT CA-Plugin (Windows)",
        path: "/download/VNPT-CA Plugin_Office_Setup.exe",
        badge: "EXE",
        meta: "Phiên bản: v2.0.8 | Dung lượng: 98 MB",
      },
      {
        label: "VNPT CA-Plugin (macOS)",
        path: "/download/VNPT-CA_Plugin_macOS.pkg",
        badge: "PKG",
        meta: "Phiên bản: v2.0.6 | Dung lượng: 76 MB",
      },
      {
        label: "CAMS Plugin (Trình ký số web)",
        path: "/download/VNPT_CAMS_Plugin_Setup.exe",
        badge: "EXE",
        meta: "Phiên bản: v1.1.5 | Dung lượng: 56 MB",
      },
    ],
  },
  {
    icon: Usb,
    title: "Driver USB Token",
    desc: "Driver thiết bị USB Token hỗ trợ nhận diện và sử dụng chữ ký số.",
    footerVariant: "direct",
    items: [
      {
        label: "eToken Driver (Windows 64bit)",
        path: "/download/documents_10052019083946.exe",
        badge: "EXE",
        meta: "Phiên bản: v5.1.1 | Dung lượng: 26 MB",
      },
      {
        label: "eToken Driver (Windows 32bit)",
        path: "/download/documents_10052019084003.exe",
        badge: "EXE",
        meta: "Phiên bản: v5.1.1 | Dung lượng: 24 MB",
      },
      {
        label: "Token v8 Driver",
        path: "/download/documents_22082022143217.exe",
        badge: "EXE",
        meta: "Phiên bản: v8.0.1 | Dung lượng: 14 MB",
      },
      {
        label: "CykenToken Driver",
        path: "/download/documents_10052019084218.exe",
        badge: "EXE",
        meta: "Phiên bản: v1.0.9 | Dung lượng: 22 MB",
      },
      {
        label: "Pkcs11 Admin Tool",
        path: "/download/documents_31072019145705.rar",
        badge: "RAR",
        meta: "Phiên bản: v1.0.3 | Dung lượng: 5 MB",
      },
    ],
  },
  {
    icon: FileText,
    title: "Tài liệu tích hợp",
    desc: "Tài liệu hướng dẫn, tài liệu kỹ thuật phục vụ tích hợp và triển khai chữ ký số.",
    footerVariant: "requireInfo",
    items: [
      {
        label: "Tổng quan tích hợp VNPT-CA",
        path: "/download/Giap_phap_tich_hop_ky_so_Vnpt-CA.pptx",
        badge: "PPTX",
        meta: "Cập nhật: 10/01/2025 | 2.1 MB",
      },
      {
        label: "Tài liệu tích hợp SignServer",
        path: "/download/Giai_phap_tich_hop_Vnpt-CA_SignServer_Final.pdf",
        badge: "PDF",
        meta: "Cập nhật: 10/01/2025 | 3.8 MB",
      },
      {
        label: "Tài liệu tích hợp CA Plugin",
        path: "/download/Giai_phap_tich_hop_Vnpt-CA_Plugin_Final.pdf",
        badge: "PDF",
        meta: "Cập nhật: 10/01/2025 | 2.6 MB",
      },
    ],
  },
];

export default function DownloadCatalogView() {
  const [activeDoc, setActiveDoc] = useState<DownloadableDoc | null>(null);

  return (
    <section id="danh-muc-tai-ve" className="scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-3">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div
                key={group.title}
                className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-vnpt-light text-vnpt">
                  <Icon size={24} />
                </span>
                <h3 className="mt-4 text-vnpt-dark">{group.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{group.desc}</p>

                <ul className="mt-5 flex-1 space-y-4">
                  {group.items.map((item) => (
                    <li
                      key={item.path}
                      className="flex items-center justify-between gap-3 border-b border-slate-50 pb-4 last:border-b-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {DOC_BADGES.has(item.badge) ? (
                            <FileText size={16} className="shrink-0 text-red-500" />
                          ) : (
                            <FileCog size={16} className="shrink-0 text-vnpt" />
                          )}
                          <span className="text-sm font-semibold text-slate-800">
                            {item.label}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              DOC_BADGES.has(item.badge)
                                ? "bg-red-50 text-red-600"
                                : "bg-vnpt-light text-vnpt"
                            }`}
                          >
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                      </div>

                      {group.footerVariant === "direct" ? (
                        <a
                          href={encodeURI(`${SMARTCA_BASE_URL}${item.path}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-vnpt px-3 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                        >
                          <Download size={14} /> Tải về
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveDoc({
                              label: item.label,
                              url: encodeURI(`${SMARTCA_BASE_URL}${item.path}`),
                            })
                          }
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-vnpt px-3 py-2 text-xs font-semibold text-white transition hover:bg-vnpt-dark"
                        >
                          <Download size={14} /> Tải về
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                <div
                  className={`mt-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium ${
                    group.footerVariant === "direct"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-vnpt-light text-vnpt-dark"
                  }`}
                >
                  {group.footerVariant === "direct" ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <Info size={16} className="shrink-0" />
                  )}
                  {group.footerVariant === "direct"
                    ? "Tải về trực tiếp, cài đặt và sử dụng ngay."
                    : "Yêu cầu cung cấp thông tin trước khi tải tài liệu."}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DownloadRequestModal doc={activeDoc} onClose={() => setActiveDoc(null)} />
    </section>
  );
}
