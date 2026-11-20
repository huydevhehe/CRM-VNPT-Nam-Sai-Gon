import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, GraduationCap, Landmark, Users } from "lucide-react";

const NEEDS = [
  {
    label: "Cá nhân/Gia đình",
    icon: Users,
    image: "/images/doi-tuong/ca-nhan.jpg",
    href: "/giai-phap/ca-nhan",
  },
  {
    label: "Trường học",
    icon: GraduationCap,
    image: "/images/doi-tuong/truong-hoc.jpg",
    href: "/giai-phap/truong-hoc",
  },
  {
    label: "Doanh nghiệp",
    icon: Building2,
    image: "/images/doi-tuong/doanh-nghiep.jpg",
    href: "/giai-phap/doanh-nghiep",
  },
  {
    label: "Phường/Xã",
    icon: Landmark,
    image: "/images/doi-tuong/co-quan-nha-nuoc.jpg",
    href: "/giai-phap/co-quan-nha-nuoc",
  },
];

export default function CustomerNeeds() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
      <div className="text-center">
        <h2 className="text-vnpt-darker">Giải pháp VNPT theo nhu cầu khách hàng</h2>
        <span className="mx-auto mt-2 block h-1 w-16 rounded-full bg-vnpt-accent" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {NEEDS.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className="group overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:border-vnpt/40 hover:shadow-md"
          >
            <div className="relative h-28 w-full sm:h-36">
              <Image
                src={n.image}
                alt={n.label}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-3 sm:px-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vnpt-light text-vnpt">
                <n.icon size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-800">{n.label}</div>
                <span className="flex items-center gap-1 text-xs font-semibold text-vnpt">
                  Tìm hiểu thêm <ArrowRight size={12} />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
