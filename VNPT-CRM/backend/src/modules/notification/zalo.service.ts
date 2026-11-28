import { SettingsService } from "../settings/settings.service.js";

export interface SendZaloMessageResult {
  sent: boolean;
  reason?: string;
}

/** API gửi tin nhắn theo mẫu (ZNS) của Zalo OA — xem https://zns.zalo.me (Zalo Notification Service). */
const ZNS_SEND_URL = "https://business.openapi.zalo.me/message/template";

interface ZnsResponseBody {
  error?: number;
  message?: string;
  data?: unknown;
}

export const ZaloService = {
  async sendZaloMessage(
    phone: string,
    templateId: string,
    params: Record<string, string>
  ): Promise<SendZaloMessageResult> {
    // Ưu tiên cấu hình Zalo OA admin nhập qua CMS (bảng system_settings), rơi về .env nếu chưa nhập.
    const zalo = await SettingsService.getEffectiveZalo();
    if (!zalo.oaToken) {
      console.log("[Zalo] Chưa cấu hình ZALO_OA_TOKEN — bỏ qua gửi thật");
      console.log(`[Zalo] (mock) Sẽ gửi tới ${phone}, template=${templateId}, params=${JSON.stringify(params)}`);
      return { sent: false, reason: "not_configured" };
    }

    try {
      const res = await fetch(ZNS_SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: zalo.oaToken,
        },
        body: JSON.stringify({
          phone,
          template_id: templateId,
          template_data: params,
        }),
      });
      const body: ZnsResponseBody | null = await res.json().catch(() => null);
      // Zalo ZNS trả error = 0 khi thành công, khác 0 kèm message khi lỗi (token hết hạn, sai template...).
      if (!res.ok || body?.error !== 0) {
        const reason = body?.message ? String(body.message) : `http_${res.status}`;
        console.warn(`[Zalo] Gửi ZNS thất bại tới ${phone} (template=${templateId}): ${reason}`);
        return { sent: false, reason };
      }
      return { sent: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "network_error";
      console.warn(`[Zalo] Lỗi gọi API Zalo OA tới ${phone}: ${reason}`);
      return { sent: false, reason };
    }
  },
};
