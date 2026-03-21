const OFFER_DRAFT_COUPON_IDS_KEY = "offerDraftCouponIds";

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function readDraftCouponIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = sessionStorage.getItem(OFFER_DRAFT_COUPON_IDS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return uniqueIds(parsed.filter((item): item is string => typeof item === "string"));
  } catch {
    return [];
  }
}

export function writeDraftCouponIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(OFFER_DRAFT_COUPON_IDS_KEY, JSON.stringify(uniqueIds(ids)));
}

export function appendDraftCouponIds(ids: string[]): string[] {
  const next = uniqueIds([...readDraftCouponIds(), ...ids]);
  writeDraftCouponIds(next);
  return next;
}

export function clearDraftCouponIds(): void {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.removeItem(OFFER_DRAFT_COUPON_IDS_KEY);
}
