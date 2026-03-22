"use client";

import { useEffect, useMemo, useState } from "react";
import PortalNavbar from "@/components/PortalNavbar";
import { getCurrentIdToken } from "@/lib/clientAuth";
import { useRequireAuth } from "@/lib/useRequireAuth";
import {
  clearCart,
  readCart,
  removeCartItem,
  type CartItem,
  updateCartQuantity,
} from "@/lib/cart";
import type { Offer } from "@/types/offer";
import type { Coupon } from "@/types/coupon";
import type { User } from "@/types/user";
import type { SelectedCoupon } from "@/types/saleOrder";

type CartStep = "order" | "address" | "payment";

interface AddressForm {
  fullName: string;
  house: string;
  city: string;
  state: string;
  pin: string;
  mobile: string;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
}

interface OfferOption {
  offerId: string;
  offerName: string;
  discountPercentage: number;
  coupons: Coupon[];
}

function timestampMillis(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
  }

  const candidate = value as {
    toMillis?: () => number;
    seconds?: number;
    _seconds?: number;
  };

  if (typeof candidate.toMillis === "function") {
    return candidate.toMillis();
  }

  if (typeof candidate._seconds === "number") {
    return candidate._seconds * 1000;
  }

  if (typeof candidate.seconds === "number") {
    return candidate.seconds * 1000;
  }

  return 0;
}

function isOfferActive(offer: Offer, now: number): boolean {
  const start = timestampMillis(offer.startDate);
  const end = timestampMillis(offer.endDate);
  return offer.availableOn === "website" && now >= start && now <= end;
}

function isCouponActive(coupon: Coupon, now: number): boolean {
  return coupon.status === "unused" && timestampMillis(coupon.expirationDate) > now;
}

const STEP_ORDER: CartStep[] = ["order", "address", "payment"];

export default function CartPage() {
  const { isAuthenticated, isLoading } = useRequireAuth();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeStep, setActiveStep] = useState<CartStep>("order");
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [address, setAddress] = useState<AddressForm>({
    fullName: "",
    house: "",
    city: "",
    state: "",
    pin: "",
    mobile: "",
  });

  const [couponOptions, setCouponOptions] = useState<OfferOption[]>([]);
  const [selectedCouponsByOffer, setSelectedCouponsByOffer] = useState<Record<string, string>>({});

  useEffect(() => {
    setCartItems(readCart());
  }, []);

  useEffect(() => {
    async function loadUserAndDiscounts() {
      try {
        const token = await getCurrentIdToken();

        const [userResponse, offersResponse] = await Promise.all([
          fetch("/api/users?current=true", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/offer", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const userPayload = (await userResponse.json()) as ApiResponse<User>;
        const offersPayload = (await offersResponse.json()) as ApiResponse<Offer[]>;

        if (!userResponse.ok || !userPayload.success || !userPayload.data) {
          throw new Error(userPayload.error || "Failed to load user profile");
        }

        if (!offersResponse.ok || !offersPayload.success) {
          throw new Error(offersPayload.error || "Failed to load offers");
        }

        const user = userPayload.data;
        setCurrentUser(user);
        setAddress((prev) => ({
          ...prev,
          fullName: user.name,
          city: user.address.city,
          state: user.address.state,
          pin: user.address.pincode,
          mobile: user.mobile,
        }));

        const now = Date.now();
        const activeOffers = (offersPayload.data || []).filter((offer) => isOfferActive(offer, now));

        const couponIds = Array.from(
          new Set(activeOffers.flatMap((offer) => offer.coupons.map((entry) => entry.couponId))),
        );

        if (couponIds.length === 0) {
          setCouponOptions([]);
          return;
        }

        const couponResponse = await fetch(`/api/coupon?ids=${couponIds.join(",")}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const couponPayload = (await couponResponse.json()) as ApiResponse<Coupon[]>;

        if (!couponResponse.ok || !couponPayload.success) {
          throw new Error(couponPayload.error || "Failed to load coupons");
        }

        const couponMap = new Map((couponPayload.data || []).map((coupon) => [coupon.couponId, coupon]));

        const options: OfferOption[] = activeOffers
          .map((offer) => {
            const eligibleCoupons = offer.coupons
              .filter((entry) => timestampMillis(entry.expirationDate) > now)
              .map((entry) => couponMap.get(entry.couponId))
              .filter((coupon): coupon is Coupon => Boolean(coupon))
              .filter((coupon) => isCouponActive(coupon, now))
              .filter((coupon) => coupon.contactId === null || coupon.contactId === user.contactId);

            return {
              offerId: offer.discountId,
              offerName: offer.name,
              discountPercentage: offer.discountPercentage,
              coupons: eligibleCoupons,
            };
          })
          .filter((option) => option.coupons.length > 0);

        setCouponOptions(options);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load checkout data");
      }
    }

    void loadUserAndDiscounts();
  }, []);

  const subtotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        return sum + item.unitPrice * item.quantity;
      }, 0),
    [cartItems],
  );

  const taxTotal = useMemo(
    () =>
      cartItems.reduce((sum, item) => {
        const taxPerUnit = (item.unitPrice * item.tax) / 100;
        return sum + taxPerUnit * item.quantity;
      }, 0),
    [cartItems],
  );

  const discountTotal = useMemo(() => {
    const selectedOfferIds = Object.keys(selectedCouponsByOffer).filter((offerId) => selectedCouponsByOffer[offerId]);

    const raw = selectedOfferIds.reduce((sum, offerId) => {
      const offer = couponOptions.find((item) => item.offerId === offerId);
      if (!offer) {
        return sum;
      }
      return sum + (subtotal * offer.discountPercentage) / 100;
    }, 0);

    return Math.min(raw, subtotal);
  }, [couponOptions, selectedCouponsByOffer, subtotal]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountTotal) + taxTotal;
  }, [subtotal, discountTotal, taxTotal]);

  const selectedCoupons = useMemo<SelectedCoupon[]>(() => {
    return Object.entries(selectedCouponsByOffer)
      .filter(([, couponId]) => Boolean(couponId))
      .map(([offerId, couponId]) => ({ offerId, couponId }));
  }, [selectedCouponsByOffer]);

  const isOrderComplete = cartItems.length > 0;
  const isAddressComplete = Boolean(
    address.fullName.trim() &&
      address.house.trim() &&
      address.city.trim() &&
      address.state.trim() &&
      address.pin.trim() &&
      address.mobile.trim(),
  );

  const maxUnlockedStepIndex = isOrderComplete ? (isAddressComplete ? 2 : 1) : 0;

  function switchStep(step: CartStep) {
    const requestedIndex = STEP_ORDER.indexOf(step);
    if (requestedIndex <= maxUnlockedStepIndex) {
      setActiveStep(step);
    }
  }

  function increaseQty(index: number) {
    const item = cartItems[index];
    if (!item) {
      return;
    }

    setCartItems(updateCartQuantity(index, item.quantity + 1));
  }

  function decreaseQty(index: number) {
    const item = cartItems[index];
    if (!item) {
      return;
    }

    setCartItems(updateCartQuantity(index, Math.max(1, item.quantity - 1)));
  }

  function removeItem(index: number) {
    const next = removeCartItem(index);
    setCartItems(next);
  }

  function removeAppliedCoupon(offerId: string) {
    setSelectedCouponsByOffer((prev) => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });
  }

  async function checkout() {
    if (!currentUser) {
      setError("Unable to identify current user");
      return;
    }

    if (!isOrderComplete || !isAddressComplete) {
      setError("Please complete Order and Address before checkout");
      return;
    }

    try {
      setIsBusy(true);
      setError(null);
      setSuccessMessage(null);

      const token = await getCurrentIdToken();

      const payload = {
        customerId: currentUser.contactId,
        order: cartItems.map((item) => {
          const taxAmount = (item.unitPrice * item.tax * item.quantity) / 100;
          const lineTotal = item.unitPrice * item.quantity + taxAmount;

          return {
            product: item.productId,
            qty: item.quantity,
            unitPrice: item.unitPrice,
            tax: item.tax,
            taxAmount,
            total: lineTotal,
          };
        }),
        totalUntaxed: Math.max(0, subtotal - discountTotal),
        totalTaxed: grandTotal,
        selectedCoupons,
      };

      const response = await fetch("/api/sale-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as ApiResponse<{ soNumber?: string }>;

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Checkout failed");
      }

      clearCart();
      setCartItems([]);
      setCheckoutDone(true);
      setSuccessMessage(`Order placed successfully${result.data?.soNumber ? ` (${result.data.soNumber})` : ""}`);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <PortalNavbar />
      {isLoading ? (
        <main className="min-h-screen app-shell px-6 py-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-zinc-600">Loading...</p>
          </div>
        </main>
      ) : (
        <main className="min-h-screen app-shell px-6 py-8">
        <section className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold text-zinc-900">Cart</h1>

          <div className="app-surface mt-6 grid grid-cols-1 gap-2 rounded-xl border border-zinc-200 p-2 sm:grid-cols-3">
            {STEP_ORDER.map((step, index) => {
              const isActive = activeStep === step;
              const unlocked = index <= maxUnlockedStepIndex;

              return (
                <button
                  key={step}
                  onClick={() => switchStep(step)}
                  disabled={!unlocked}
                  className={`rounded-lg px-4 py-3 text-sm font-semibold capitalize ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : unlocked
                        ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                        : "bg-zinc-50 text-zinc-400"
                  }`}
                >
                  {index + 1}. {step}
                </button>
              );
            })}
          </div>

          {error ? <p className="mt-4 rounded-lg bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {successMessage ? <p className="mt-4 rounded-lg bg-emerald-100 px-4 py-3 text-sm text-emerald-700">{successMessage}</p> : null}

          <div className="app-surface mt-6 rounded-xl border border-zinc-200 p-5">
            {activeStep === "order" ? (
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Order</h2>

                {cartItems.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-600">Your cart is empty.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {cartItems.map((item, index) => (
                      <div key={`${item.productId}-${item.color ?? "none"}-${index}`} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-zinc-900">{item.productName}</p>
                          <p className="text-sm text-zinc-600">{item.color ? `Color: ${item.color}` : "No color selected"}</p>
                          <p className="text-sm text-zinc-600">₹{item.unitPrice.toFixed(2)} each</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center rounded-lg border border-zinc-300">
                            <button onClick={() => decreaseQty(index)} className="px-3 py-2 text-zinc-700 hover:bg-zinc-100">-</button>
                            <span className="min-w-10 px-3 text-center text-sm font-semibold text-zinc-900">{item.quantity}</span>
                            <button onClick={() => increaseQty(index)} className="px-3 py-2 text-zinc-700 hover:bg-zinc-100">+</button>
                          </div>

                          <button
                            onClick={() => removeItem(index)}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => switchStep("address")}
                    disabled={!isOrderComplete}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    Continue to Address
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "address" ? (
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Address</h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-sm font-medium text-zinc-700">Full Name</span>
                    <input
                      value={address.fullName}
                      onChange={(event) => setAddress((prev) => ({ ...prev, fullName: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-sm font-medium text-zinc-700">House / Street</span>
                    <input
                      value={address.house}
                      onChange={(event) => setAddress((prev) => ({ ...prev, house: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-zinc-700">City</span>
                    <input
                      value={address.city}
                      onChange={(event) => setAddress((prev) => ({ ...prev, city: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-zinc-700">State</span>
                    <input
                      value={address.state}
                      onChange={(event) => setAddress((prev) => ({ ...prev, state: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-zinc-700">PIN</span>
                    <input
                      value={address.pin}
                      onChange={(event) => setAddress((prev) => ({ ...prev, pin: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-zinc-700">Mobile</span>
                    <input
                      value={address.mobile}
                      onChange={(event) => setAddress((prev) => ({ ...prev, mobile: event.target.value }))}
                      className="h-10 rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                    />
                  </label>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => switchStep("order")}
                    className="rounded-lg border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700"
                  >
                    Back
                  </button>

                  <button
                    onClick={() => switchStep("payment")}
                    disabled={!isAddressComplete}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    Continue to Payment
                  </button>
                </div>
              </div>
            ) : null}

            {activeStep === "payment" ? (
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Payment</h2>

                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between text-sm text-zinc-700">
                    <span>Subtotal (without tax)</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-zinc-700">
                    <span>Taxes</span>
                    <span>₹{taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-zinc-700">
                    <span>Discount</span>
                    <span>- ₹{discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 border-t border-zinc-200 pt-3 text-base font-semibold text-zinc-900 flex items-center justify-between">
                    <span>Total</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-6 rounded-lg border border-zinc-200 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900">Apply Discount</h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    You can select coupons from multiple offers. Only one coupon is allowed per offer.
                  </p>

                  <div className="mt-3 space-y-3">
                    {couponOptions.map((offer) => (
                      <div key={offer.offerId} className="rounded-lg border border-zinc-200 p-3">
                        <p className="text-sm font-semibold text-zinc-900">
                          {offer.offerName} ({offer.discountPercentage}% off)
                        </p>
                        <select
                          value={selectedCouponsByOffer[offer.offerId] || ""}
                          onChange={(event) =>
                            setSelectedCouponsByOffer((prev) => ({
                              ...prev,
                              [offer.offerId]: event.target.value,
                            }))
                          }
                          className="mt-2 h-10 w-full rounded-lg border border-zinc-300 px-3 text-sm outline-none focus:border-emerald-600"
                        >
                          <option value="">Select coupon code ({offer.offerName})</option>
                          {offer.coupons.map((coupon) => (
                            <option key={coupon.couponId} value={coupon.couponId}>
                              {coupon.code} ({offer.offerName})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-3">
                    {couponOptions.length === 0 ? (
                      <p className="text-sm text-zinc-600">No active website coupons available.</p>
                    ) : (
                      Object.entries(selectedCouponsByOffer).map(([offerId, couponId]) => {
                        const offer = couponOptions.find((item) => item.offerId === offerId);
                        const coupon = offer?.coupons.find((item) => item.couponId === couponId);

                        if (!offer || !coupon) {
                          return null;
                        }

                        return (
                          <div key={`${offerId}-${couponId}`} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                            <p className="text-sm text-zinc-800">
                              {coupon.code} ({offer.offerName}) - {offer.discountPercentage}%
                            </p>
                            <button
                              onClick={() => removeAppliedCoupon(offerId)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-between">
                  <button
                    onClick={() => switchStep("address")}
                    className="rounded-lg border border-zinc-300 bg-white px-5 py-2 text-sm font-semibold text-zinc-700"
                  >
                    Back
                  </button>

                  <button
                    onClick={checkout}
                    disabled={isBusy || checkoutDone || cartItems.length === 0}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:bg-zinc-400"
                  >
                    {isBusy ? "Processing..." : "Checkout"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
      )}
    </>
  );
}
