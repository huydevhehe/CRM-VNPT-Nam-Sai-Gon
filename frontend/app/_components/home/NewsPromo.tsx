import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Article } from "@/lib/types";

const TAGS = ["INTERNET VNPT", "ƯU ĐÃI DỊCH VỤ", "GIẢI PHÁP CNTT"];

export default function NewsPromo({ articles }: Readonly<{ articles: Article[] }>) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <p className="text-xs font-bold tracking-wide text-vnpt">CẬP NHẬT THÔNG TIN MỚI</p>
      <div className="mt-1 flex items-end justify-between gap-4">
        <h2 className="text-vnpt-darker">Tin tức &amp; Ưu đãi</h2>
        <Link
          href="/tin-tuc"
          className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-vnpt hover:text-vnpt-dark sm:flex"
        >
          Xem tất cả bài viết <ArrowRight size={14} />
        </Link>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Cập nhật tin tức dịch vụ, chương trình ưu đãi và những thông tin hữu ích dành cho khách hàng VNPT.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {articles.map((a, i) => (
          <Link
            key={a.id}
            href={`/tin-tuc/${a.slug}`}
            className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="relative h-40 w-full">
              {a.images[0] && (
                <Image
                  src={a.images[0]}
                  alt={a.title}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              )}
              <span className="absolute left-3 top-3 rounded bg-vnpt px-2 py-1 text-[10px] font-bold text-white">
                {TAGS[i % TAGS.length]}
              </span>
            </div>
            <div className="p-4">
              <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{a.title}</h3>
              <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                {a.bodyText.replace(/^#+\s*/gm, "").slice(0, 110)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 text-center sm:hidden">
        <Link href="/tin-tuc" className="inline-flex items-center gap-1 text-sm font-semibold text-vnpt">
          Xem tất cả bài viết <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
