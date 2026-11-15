import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Globe2, Play, Wifi } from "lucide-react";

// Hero trang chủ — khớp Home_2.png.
// Desktop (>=lg): ảnh gia đình bên trái, tiêu đề/mô tả/CTA bên phải kèm cụm icon nổi.
// Mobile (<lg): ảnh và chữ gộp chung một khối, chữ phủ trên ảnh (gradient tối phía dưới).
export default function Hero() {
  const dots = (
    <div className="flex items-center justify-center gap-2 pb-6 pt-4">
      <span className="h-2 w-6 rounded-full bg-vnpt" />
      <span className="h-2 w-2 rounded-full bg-vnpt/25" />
      <span className="h-2 w-2 rounded-full bg-vnpt/25" />
    </div>
  );

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-vnpt-light/70 to-white">
      {/* ----- Mobile / Tablet (< lg): ảnh + chữ phủ trong 1 khối ----- */}
      <div className="px-4 pt-4 lg:hidden">
        <div className="relative h-[380px] w-full overflow-hidden rounded-2xl sm:h-[440px]">
          <Image
            src="/images/doi-tuong/ca-nhan.jpg"
            alt="Gia đình trải nghiệm dịch vụ VNPT"
            fill
            priority
            sizes="calc(100vw - 32px)"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-vnpt-darker/95 via-vnpt-darker/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <h1 className="text-2xl leading-tight sm:text-3xl">
              Kết nối thông minh
              <br />
              Kiến tạo tương lai số
            </h1>
            <p className="mt-3 text-sm text-white/85">
              Cùng VNPT trải nghiệm dịch vụ viễn thông và công nghệ hiện đại nhất
            </p>
            <Link
              href="/giai-phap"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-vnpt px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
            >
              Khám phá giải pháp
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      {/* ----- Desktop (>= lg): ảnh trái, chữ phải + icon nổi ----- */}
      <div className="mx-auto hidden max-w-7xl gap-10 px-6 py-14 lg:grid lg:grid-cols-2">
        <div className="relative h-[420px] overflow-hidden rounded-2xl">
          <Image
            src="/images/doi-tuong/ca-nhan.jpg"
            alt="Gia đình trải nghiệm dịch vụ VNPT"
            fill
            priority
            sizes="50vw"
            className="object-cover"
          />
        </div>

        {/* Cột chữ cao bằng ảnh để icon nổi có chỗ trống phía trên tiêu đề */}
        <div className="relative flex h-[420px] flex-col justify-center">
          <h1 className="text-4xl leading-tight text-vnpt-darker">
            Kết nối thông minh
            <br />
            Kiến tạo tương lai số
          </h1>
          <p className="mt-4 max-w-sm text-slate-600">
            Cùng VNPT trải nghiệm dịch vụ viễn thông và công nghệ hiện đại nhất
          </p>
          <Link
            href="/giai-phap"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-md bg-vnpt px-6 py-3 text-sm font-semibold text-white transition hover:bg-vnpt-dark"
          >
            Khám phá giải pháp
            <ArrowRight size={16} />
          </Link>

          {/* Cụm icon nổi — đặt trong khoảng trống phía trên tiêu đề, không đè lên chữ */}
          <div className="pointer-events-none absolute right-2 top-0 h-28 w-28 xl:right-6">
            <span className="absolute left-4 top-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-vnpt to-vnpt-darker text-white shadow-lg animate-float">
              <Wifi size={24} />
            </span>
            <span className="absolute left-20 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white text-vnpt shadow-md ring-1 ring-vnpt-light animate-float-slow">
              <Play size={16} fill="currentColor" />
            </span>
            <span className="absolute left-0 top-14 flex h-11 w-11 items-center justify-center rounded-xl bg-vnpt-light text-vnpt shadow-md animate-float">
              <Globe2 size={20} />
            </span>
          </div>
        </div>
      </div>

      {dots}
    </section>
  );
}
