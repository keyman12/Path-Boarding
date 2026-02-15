"use client";

import { useState } from "react";
import Image from "next/image";
import { PRODUCT_IMAGES } from "./ProductPackageWizard";

const ACQUIRING_DISPLAY_NAMES: Record<string, string> = {
  cnp: "Card Not Present",
  credit: "Credit Cards",
  cross_border: "Cross Border Transactions",
  debit: "Debit Cards",
  premium: "Premium Cards",
};

const PRODUCT_DESCRIPTIONS: Record<string, string> = {
  pax_a920_pro: "All-in-one countertop payment terminal with touchscreen and card reader.",
  verifone_p400: "Compact countertop terminal for in-store card and contactless payments.",
  softpos: "Turn your smartphone into a payment terminal with Tap to Pay.",
  payby_link: "Send payment links to customers for remote card payments.",
  virtual_terminal: "Generate QR codes for in-person or remote payments.",
  debit: "Transaction fee applied to debit card payments.",
  credit: "Transaction fee applied to credit card payments.",
  premium: "Transaction fee for premium/rewards card payments.",
  cross_border: "Fee for cross-border card transactions.",
  cnp: "Fee for card-not-present (online/phone) transactions.",
  auth_fee: "Per-transaction authorisation fee.",
  refund_fee: "Fee applied when processing refunds.",
  three_d_secure_fee: "3D Secure authentication fee for online payments.",
};

type ProductPackageItemDisplay = {
  id: string;
  product_code: string;
  product_name: string;
  product_type: string;
  config?: Record<string, unknown>;
  store_name?: string | null;
  store_address?: string | null;
  epos_terminal?: string | null;
};

type ProductPackageDisplay = {
  id: string;
  uid: string;
  name: string;
  description?: string | null;
  items: ProductPackageItemDisplay[];
};

type PurchasedProductsSummaryProps = {
  productPackage: ProductPackageDisplay;
  partnerName: string;
  variant?: "default" | "sidebar";
  title?: string;
};

function formatPrice(item: ProductPackageItemDisplay): string {
  const cfg = item.config ?? {};
  if (cfg.pos_price_per_month != null) {
    return `£${(cfg.pos_price_per_month as number).toFixed(2)}/month`;
  }
  if (cfg.pos_pricing_type === "per_device_service") {
    const parts: string[] = [];
    if (cfg.pos_price_per_device != null) {
      parts.push(`£${(cfg.pos_price_per_device as number).toFixed(2)} per device`);
    }
    if (cfg.pos_monthly_service != null) {
      parts.push(`£${(cfg.pos_monthly_service as number).toFixed(2)}/month service`);
    }
    return parts.join(" + ") || "—";
  }
  if (cfg.amount != null && (item.product_type === "ecomm" || item.product_type === "other_fee")) {
    if (item.product_type === "ecomm") {
      const unit = item.product_code === "payby_link" ? "link" : "QR code";
      return `£${(cfg.amount as number).toFixed(2)} per ${unit}`;
    }
    return `£${(cfg.amount as number).toFixed(2)} per transaction`;
  }
  if (cfg.pct != null) {
    return `${(cfg.pct as number)}%`;
  }
  return "—";
}

export function PurchasedProductsSummary({ productPackage, partnerName, variant = "default", title = "Your purchase" }: PurchasedProductsSummaryProps) {
  const [activeTab, setActiveTab] = useState<"products" | "fees">("products");

  const productsItems = productPackage.items.filter(
    (i) => i.product_type === "physical_pos" || i.product_type === "ecomm"
  );
  const feesItems = productPackage.items.filter(
    (i) => i.product_type === "acquiring" || i.product_type === "other_fee"
  );

  const hasProducts = productsItems.length > 0;
  const hasFees = feesItems.length > 0;

  if (!hasProducts && !hasFees) return null;

  const isSidebar = variant === "sidebar";

  return (
    <section className={`overflow-hidden ${isSidebar ? "flex flex-col min-h-0 bg-transparent" : "mb-8 rounded-xl border border-path-grey-200 bg-white shadow-sm"}`}>
      <div className={`shrink-0 ${isSidebar ? "px-0 py-3 border-b border-white/20" : "bg-gradient-to-r from-path-primary/5 to-path-primary/10 border-b border-path-grey-200 px-5 py-4"}`}>
        <h2 className={`font-poppins ${isSidebar ? "text-path-p1 font-semibold text-white" : "text-path-h4 text-path-primary"}`}>{title}</h2>
        <p className={`mt-0.5 ${isSidebar ? "text-sm text-white/90" : "text-path-p2 text-path-grey-700"}`}>
          {productPackage.name}
          {productPackage.description && (
            <span className={`block mt-1 ${isSidebar ? "text-white/80" : "text-path-grey-600"}`}>{productPackage.description}</span>
          )}
        </p>
      </div>

      <div className={`flex shrink-0 ${isSidebar ? "border-b border-white/20" : "border-b border-path-grey-200"}`}>
        {hasProducts && (
          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`flex-1 font-medium transition-colors ${isSidebar ? "px-3 py-2.5 text-sm" : "px-5 py-3.5 text-path-p2"} ${
              isSidebar
                ? activeTab === "products"
                  ? "text-white border-b-2 border-white -mb-px"
                  : "text-white/70 hover:text-white"
                : activeTab === "products"
                  ? "bg-white text-path-primary border-b-2 border-path-primary -mb-px"
                  : "text-path-grey-600 hover:text-path-grey-900 hover:bg-path-grey-50"
            }`}
          >
            Products & Services
          </button>
        )}
        {hasFees && (
          <button
            type="button"
            onClick={() => setActiveTab("fees")}
            className={`flex-1 font-medium transition-colors ${isSidebar ? "px-3 py-2.5 text-sm" : "px-5 py-3.5 text-path-p2"} ${
              isSidebar
                ? activeTab === "fees"
                  ? "text-white border-b-2 border-white -mb-px"
                  : "text-white/70 hover:text-white"
                : activeTab === "fees"
                  ? "bg-white text-path-primary border-b-2 border-path-primary -mb-px"
                  : "text-path-grey-600 hover:text-path-grey-900 hover:bg-path-grey-50"
            }`}
          >
            Payment Fees
          </button>
        )}
      </div>

      <div className={`overflow-y-auto flex-1 min-h-0 ${isSidebar ? "p-3 max-h-[calc(100vh-320px)]" : "p-5"}`}>
        {activeTab === "products" && hasProducts && (
          <div className={isSidebar ? "space-y-3" : "space-y-4"}>
            {productsItems.map((item) => {
              const productImage = item.product_code ? PRODUCT_IMAGES[item.product_code] : null;
              const desc = PRODUCT_DESCRIPTIONS[item.product_code] ?? "";
              return (
                <div
                  key={item.id}
                  className={`flex rounded-lg ${isSidebar ? "p-3 gap-3 bg-white/10" : "gap-4 p-4 bg-path-grey-50 border border-path-grey-100"}`}
                >
                  {productImage && (
                    <div className={`flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center ${isSidebar ? "w-12 h-12 bg-white/20" : "w-16 h-16 bg-white border border-path-grey-200"}`}>
                      <Image
                        src={productImage}
                        alt={item.product_name}
                        width={isSidebar ? 48 : 64}
                        height={isSidebar ? 48 : 64}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className={`font-medium ${isSidebar ? "text-white" : "text-path-grey-900"}`}>{item.product_name}</h3>
                        {desc && (
                          <p className={`mt-0.5 ${isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}`}>{desc}</p>
                        )}
                      </div>
                      <span className={`font-semibold whitespace-nowrap ${isSidebar ? "text-white" : "text-path-primary"}`}>
                        {formatPrice(item)}
                      </span>
                    </div>
                    {(item.store_name || item.store_address || item.epos_terminal) && (
                      <div className={`mt-2 pt-2 space-y-0.5 ${isSidebar ? "border-t border-white/20" : "border-t border-path-grey-200"}`}>
                        {item.store_name && (
                          <p className={isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}>
                            <span className="font-medium">Store:</span> {item.store_name}
                          </p>
                        )}
                        {item.store_address && (
                          <p className={isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}>
                            <span className="font-medium">Address:</span> {item.store_address}
                          </p>
                        )}
                        {item.epos_terminal && (
                          <p className={isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}>
                            <span className="font-medium">EPOS:</span> {item.epos_terminal}
                          </p>
                        )}
                      </div>
                    )}
                    {item.config?.qty != null && (item.config.qty as number) > 1 && (
                      <p className={`mt-1 ${isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}`}>
                        Quantity: {item.config.qty as number}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "fees" && hasFees && (
          <div className="space-y-3">
            {feesItems.map((item) => {
              const displayName =
                item.product_type === "acquiring"
                  ? ACQUIRING_DISPLAY_NAMES[item.product_code] ?? item.product_name
                  : item.product_name;
              const desc = PRODUCT_DESCRIPTIONS[item.product_code] ?? "";
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between gap-4 rounded-lg ${isSidebar ? "p-3 bg-white/10" : "p-4 bg-path-grey-50 border border-path-grey-100"}`}
                >
                  <div>
                    <h3 className={`font-medium ${isSidebar ? "text-white" : "text-path-grey-900"}`}>{displayName}</h3>
                    {desc && (
                      <p className={`mt-0.5 ${isSidebar ? "text-sm text-white/80" : "text-path-p2 text-path-grey-600"}`}>{desc}</p>
                    )}
                  </div>
                  <span className={`font-semibold whitespace-nowrap ${isSidebar ? "text-white" : "text-path-primary"}`}>
                    {formatPrice(item)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={`shrink-0 ${isSidebar ? "px-0 py-2 border-t border-white/20" : "bg-path-grey-50 border-t border-path-grey-200 px-5 py-3"}`}>
        <p className={`${isSidebar ? "text-xs text-white/70" : "text-path-p2 text-path-grey-500"}`}>
          To change your products or fees, please contact {partnerName}.
        </p>
      </div>
    </section>
  );
}
