"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  ChannelSource,
  ChannelSourceKind,
  createChannelSource,
  deleteChannelSource,
  getChannelSources,
  reorderChannelSources,
  updateChannelSource,
} from "@/lib/api/channel-sources.api";

interface SectionConfig {
  kind: ChannelSourceKind;
  title: string;
  description: string;
  placeholder: string;
  emptyText: string;
}

const SECTIONS: SectionConfig[] = [
  {
    kind: "online",
    title: "Nguồn Online",
    description: "Dùng khi kênh phát triển là Online (ví dụ Zalo Ads, Facebook, Website A, Website B...).",
    placeholder: "Tên nguồn Online mới, ví dụ: Website A",
    emptyText: "Chưa có nguồn Online nào.",
  },
  {
    kind: "partner",
    title: "Đối tác",
    description: "Dùng khi kênh phát triển là Đối tác. Thêm tên từng đối tác để chọn khi nhập Lead.",
    placeholder: "Tên đối tác mới",
    emptyText: "Chưa có đối tác nào. Hãy thêm đối tác đầu tiên bên dưới.",
  },
];

export default function ChannelSourcesPage() {
  const [items, setItems] = useState<ChannelSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await getChannelSources({ includeInactive: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh mục kênh. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Danh mục kênh</h2>
        <p className="text-xs text-slate-500">
          Quản lý danh sách nguồn Online và đối tác. Danh sách này dùng để chọn &quot;Chi tiết kênh&quot; khi nhập Lead.
          Mục đã được dùng sẽ không xóa hẳn mà chỉ chuyển sang ẩn.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          data-testid="channel-sources-notice"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Đóng thông báo">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Đang tải danh mục kênh...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {SECTIONS.map((section) => (
            <SourceSection
              key={section.kind}
              config={section}
              items={items.filter((i) => i.kind === section.kind)}
              onChanged={load}
              onNotice={setNotice}
              onError={setError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SourceSection({
  config,
  items,
  onChanged,
  onNotice,
  onError,
}: Readonly<{
  config: SectionConfig;
  items: ChannelSource[];
  onChanged: () => Promise<void>;
  onNotice: (message: string | null) => void;
  onError: (message: string | null) => void;
}>) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function guard(id: string | null, action: () => Promise<void>) {
    onError(null);
    onNotice(null);
    setBusyId(id);
    try {
      await action();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Thao tác thất bại. Vui lòng thử lại.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    await guard(null, async () => {
      await createChannelSource({ kind: config.kind, name });
      setNewName("");
    });
    setAdding(false);
  }

  async function handleRename(item: ChannelSource) {
    const name = editName.trim();
    if (!name || name === item.name) {
      setEditingId(null);
      return;
    }
    await guard(item.id, async () => {
      await updateChannelSource(item.id, { name });
      setEditingId(null);
    });
  }

  async function handleMove(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await guard(items[index].id, async () => {
      await reorderChannelSources(config.kind, ids);
    });
  }

  async function handleDelete(item: ChannelSource) {
    setConfirmDeleteId(null);
    await guard(item.id, async () => {
      const result = await deleteChannelSource(item.id);
      onNotice(result.message);
    });
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
      data-testid={`channel-section-${config.kind}`}
    >
      <h3 className="text-base font-bold text-slate-900">{config.title}</h3>
      <p className="mb-4 text-xs text-slate-500">{config.description}</p>

      {items.length === 0 ? (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">{config.emptyText}</p>
      ) : (
        <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
          {items.map((item, index) => (
            <li
              key={item.id}
              data-testid="channel-source-row"
              className={`flex flex-wrap items-center gap-2 px-3 py-2 ${item.active ? "" : "bg-slate-50"}`}
            >
              <div className="min-w-0 flex-1">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    value={editName}
                    maxLength={100}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(item);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    aria-label="Tên mới"
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-vnpt focus:outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${item.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                      {item.name}
                    </span>
                    {!item.active && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Đã ẩn</span>
                    )}
                    {(item.usageCount ?? 0) > 0 && (
                      <span className="text-[11px] text-slate-400">đang dùng ở {item.usageCount} bản ghi</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {editingId === item.id ? (
                  <>
                    <IconButton title="Lưu tên" onClick={() => handleRename(item)} disabled={busyId === item.id}>
                      <Check className="h-4 w-4 text-emerald-600" />
                    </IconButton>
                    <IconButton title="Hủy sửa" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  </>
                ) : confirmDeleteId === item.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={busyId === item.id}
                      data-testid="channel-source-confirm-delete"
                      className="rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                      Xác nhận xóa
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                  </>
                ) : (
                  <>
                    <IconButton title="Lên" onClick={() => handleMove(index, -1)} disabled={index === 0 || busyId !== null}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title="Xuống"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === items.length - 1 || busyId !== null}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title="Sửa tên"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditName(item.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      title={item.active ? "Ẩn khỏi danh sách chọn" : "Hiện lại"}
                      onClick={() =>
                        guard(item.id, async () => {
                          await updateChannelSource(item.id, { active: !item.active });
                        })
                      }
                      disabled={busyId === item.id}
                    >
                      {item.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </IconButton>
                    <IconButton title="Xóa" onClick={() => setConfirmDeleteId(item.id)} danger>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={newName}
          maxLength={100}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={config.placeholder}
          aria-label={`Tên ${config.title} mới`}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-vnpt focus:outline-none"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-vnpt px-3.5 text-xs font-bold text-white hover:bg-vnpt-dark disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </form>
    </section>
  );
}

function IconButton({
  title,
  onClick,
  disabled,
  danger,
  children,
}: Readonly<{
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg p-1.5 hover:bg-slate-100 disabled:opacity-40 ${
        danger ? "text-rose-500 hover:text-rose-700" : "text-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
