"use client";

import { useEffect, useState } from "react";
import { ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  addCustomListItem,
  createCustomList,
  deleteCustomList,
  deleteCustomListItem,
  getCustomLists,
  renameCustomList,
  updateCustomListItem,
  type CustomList,
} from "@/lib/api/custom-lists.api";

/**
 * Chỉ danh mục đúng tên này mới thực sự được nơi khác trong hệ thống đọc dữ
 * liệu (QuoteModal.tsx dùng làm "chọn nhanh gói dịch vụ"). Mọi danh mục khác
 * Admin tự đặt tên chỉ là CRUD trần trụi, KHÔNG tự áp dụng ở đâu — cần báo
 * dev code thêm chỗ đọc nếu muốn dùng (feedback khách: "chỉnh sửa thêm xóa
 * không thấy có tác dụng và ứng dụng ở mục nào").
 */
const WIRED_LIST_NAME = "Gói dịch vụ Internet/Fiber";
const WIRED_LIST_USAGE = "Báo giá";

export default function CustomListsPage() {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newListName, setNewListName] = useState("");
  const [newItemValue, setNewItemValue] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemValue, setEditingItemValue] = useState("");
  const [editingItemPrice, setEditingItemPrice] = useState("");

  function reload() {
    setLoading(true);
    getCustomLists()
      .then((data) => {
        setLists(data);
        setSelectedId((prev) => prev ?? data[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh mục"))
      .finally(() => setLoading(false));
  }

  useEffect(reload, []);

  const selected = lists.find((l) => l.id === selectedId) ?? null;

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setError(null);
    try {
      const created = await createCustomList(newListName.trim());
      setNewListName("");
      setLists((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được danh mục");
    }
  }

  async function handleRenameList(id: string) {
    if (!editingListName.trim()) return;
    setError(null);
    try {
      const updated = await renameCustomList(id, editingListName.trim());
      setLists((prev) => prev.map((l) => (l.id === id ? { ...l, name: updated.name } : l)));
      setEditingListId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không đổi được tên danh mục");
    }
  }

  async function handleDeleteList(id: string, name: string) {
    if (!window.confirm(`Xóa danh mục "${name}" và toàn bộ giá trị bên trong?`)) return;
    setError(null);
    try {
      await deleteCustomList(id);
      setLists((prev) => prev.filter((l) => l.id !== id));
      setSelectedId((prev) => (prev === id ? null : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được danh mục");
    }
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !newItemValue.trim()) return;
    setError(null);
    try {
      const price = newItemPrice.trim() ? Number(newItemPrice) : undefined;
      const item = await addCustomListItem(selected.id, newItemValue.trim(), price);
      setNewItemValue("");
      setNewItemPrice("");
      setLists((prev) =>
        prev.map((l) => (l.id === selected.id ? { ...l, items: [...l.items, item] } : l))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thêm được giá trị");
    }
  }

  async function handleRenameItem(itemId: string) {
    if (!selected || !editingItemValue.trim()) return;
    setError(null);
    try {
      const price = editingItemPrice.trim() ? Number(editingItemPrice) : null;
      const updated = await updateCustomListItem(itemId, { value: editingItemValue.trim(), price });
      setLists((prev) =>
        prev.map((l) =>
          l.id === selected.id
            ? { ...l, items: l.items.map((i) => (i.id === itemId ? updated : i)) }
            : l
        )
      );
      setEditingItemId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không sửa được giá trị");
    }
  }

  async function handleToggleItemActive(itemId: string, active: boolean) {
    if (!selected) return;
    setError(null);
    try {
      const updated = await updateCustomListItem(itemId, { active });
      setLists((prev) =>
        prev.map((l) =>
          l.id === selected.id
            ? { ...l, items: l.items.map((i) => (i.id === itemId ? updated : i)) }
            : l
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được trạng thái");
    }
  }

  async function handleDeleteItem(itemId: string, value: string) {
    if (!selected) return;
    if (!window.confirm(`Xóa giá trị "${value}"?`)) return;
    setError(null);
    try {
      await deleteCustomListItem(itemId);
      setLists((prev) =>
        prev.map((l) =>
          l.id === selected.id ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được giá trị");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Danh mục tùy biến</h1>
        <p className="mt-1 text-sm text-slate-500">
          Nơi Admin tự thêm/sửa các danh sách lựa chọn dùng ở nơi khác trong hệ thống — không cần
          dev sửa code. Hiện tại chỉ đúng 1 danh mục{" "}
          <span className="font-semibold text-slate-700">&quot;{WIRED_LIST_NAME}&quot;</span>{" "}
          là đang thực sự được dùng: khi nhân viên lập{" "}
          <span className="font-semibold text-slate-700">{WIRED_LIST_USAGE}</span>, chọn nhanh 1 gói
          trong danh mục này sẽ tự điền tên gói và đơn giá. Thêm gói mới hoặc sửa giá ở đây là áp
          dụng ngay, không cần chờ dev.
        </p>
        <p className="mt-1 text-xs text-amber-700">
          Lưu ý: nếu tự tạo thêm 1 danh mục khác với tên khác, danh mục đó <strong>chưa</strong> tự
          hiện ra ở đâu cả — cần báo dev code thêm chỗ đọc (giống xem badge bên dưới mỗi danh mục).
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Danh mục
            </h2>
            <ul className="space-y-1">
              {lists.map((l) => (
                <li key={l.id}>
                  {editingListId === l.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={editingListName}
                        onChange={(e) => setEditingListName(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-vnpt focus:outline-none"
                      />
                      <button
                        onClick={() => handleRenameList(l.id)}
                        className="shrink-0 rounded-lg bg-vnpt px-2 py-1 text-xs font-bold text-white"
                      >
                        Lưu
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm ${
                        l.id === selectedId ? "bg-sky-50 font-semibold text-vnpt" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <button
                        data-testid={`custom-list-item-${l.id}`}
                        onClick={() => setSelectedId(l.id)}
                        className="flex-1 text-left"
                      >
                        <div>
                          {l.name} <span className="text-xs text-slate-400">({l.items.length})</span>
                        </div>
                        {l.name === WIRED_LIST_NAME ? (
                          <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Đang dùng tại: {WIRED_LIST_USAGE}
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                            Chưa áp dụng ở đâu
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-0.5">
                        <button
                          aria-label="Đổi tên"
                          onClick={() => {
                            setEditingListId(l.id);
                            setEditingListName(l.name);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Xóa danh mục"
                          onClick={() => handleDeleteList(l.id, l.name)}
                          className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <form onSubmit={handleCreateList} className="mt-3 flex gap-1.5 border-t pt-3">
              <input
                data-testid="new-list-name"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Tên danh mục mới..."
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-vnpt focus:outline-none"
              />
              <button
                type="submit"
                data-testid="create-list-submit"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-vnpt px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vnpt-dark"
              >
                <ListPlus className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {!selected ? (
              <p className="text-sm text-slate-400">Chọn hoặc tạo 1 danh mục ở bên trái.</p>
            ) : (
              <>
                <h2 className="mb-3 text-sm font-bold text-slate-900">
                  Giá trị trong &quot;{selected.name}&quot;
                </h2>
                <ul className="space-y-1.5">
                  {selected.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      {editingItemId === item.id ? (
                        <div className="flex w-full items-center gap-1.5">
                          <input
                            autoFocus
                            value={editingItemValue}
                            onChange={(e) => setEditingItemValue(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-vnpt focus:outline-none"
                          />
                          <input
                            type="number"
                            min={0}
                            value={editingItemPrice}
                            onChange={(e) => setEditingItemPrice(e.target.value)}
                            placeholder="Đơn giá (tùy chọn)"
                            className="w-36 shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-vnpt focus:outline-none"
                          />
                          <button
                            onClick={() => handleRenameItem(item.id)}
                            className="shrink-0 rounded-lg bg-vnpt px-2 py-1 text-xs font-bold text-white"
                          >
                            Lưu
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className={`text-sm ${item.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                            {item.value}
                            {item.price !== null && (
                              <span className="ml-2 text-xs font-medium text-slate-400">
                                {item.price.toLocaleString("vi-VN")} ₫
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleItemActive(item.id, !item.active)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              {item.active ? "Ẩn" : "Hiện"}
                            </button>
                            <button
                              aria-label="Đổi tên giá trị"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditingItemValue(item.value);
                                setEditingItemPrice(item.price !== null ? String(item.price) : "");
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              aria-label="Xóa giá trị"
                              onClick={() => handleDeleteItem(item.id, item.value)}
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  ))}
                  {selected.items.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-400">Chưa có giá trị nào.</p>
                  )}
                </ul>

                <form onSubmit={handleAddItem} className="mt-3 flex gap-1.5 border-t pt-3">
                  <input
                    data-testid="new-item-value"
                    value={newItemValue}
                    onChange={(e) => setNewItemValue(e.target.value)}
                    placeholder="Thêm giá trị mới..."
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-vnpt focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    data-testid="new-item-price"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="Đơn giá (tùy chọn)"
                    className="w-36 shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-vnpt focus:outline-none"
                  />
                  <button
                    type="submit"
                    data-testid="add-item-submit"
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-vnpt px-2.5 py-1.5 text-xs font-bold text-white hover:bg-vnpt-dark"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
