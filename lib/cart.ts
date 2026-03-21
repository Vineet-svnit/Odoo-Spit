export interface CartItem {
  productId: string;
  productName: string;
  image: string | null;
  color: string | null;
  unitPrice: number;
  tax: number;
  quantity: number;
}

const CART_KEY = "portalCartItems";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function normalizeCart(items: CartItem[]): CartItem[] {
  return items
    .filter((item) => item.productId && item.quantity > 0)
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Math.floor(item.quantity)),
    }));
}

export function readCart(): CartItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = localStorage.getItem(CART_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeCart(parsed as CartItem[]);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(items)));
}

export function clearCart(): void {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(CART_KEY);
}

export function addToCart(item: CartItem): void {
  const current = readCart();
  const existingIndex = current.findIndex(
    (cartItem) =>
      cartItem.productId === item.productId &&
      (cartItem.color ?? "") === (item.color ?? ""),
  );

  if (existingIndex >= 0) {
    current[existingIndex] = {
      ...current[existingIndex],
      quantity: current[existingIndex].quantity + item.quantity,
    };
  } else {
    current.push(item);
  }

  writeCart(current);
}

export function updateCartQuantity(index: number, quantity: number): CartItem[] {
  const current = readCart();

  if (index < 0 || index >= current.length) {
    return current;
  }

  current[index] = {
    ...current[index],
    quantity: Math.max(1, Math.floor(quantity)),
  };

  writeCart(current);
  return current;
}

export function removeCartItem(index: number): CartItem[] {
  const current = readCart();

  if (index < 0 || index >= current.length) {
    return current;
  }

  const next = current.filter((_, itemIndex) => itemIndex !== index);
  writeCart(next);
  return next;
}
