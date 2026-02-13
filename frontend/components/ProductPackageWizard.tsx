"use client";

import { useState } from "react";

export type CatalogProduct = {
  id: string;
  product_type: string;
  product_code: string;
  name: string;
  config_schema?: Record<string, unknown>;
  requires_store_epos: boolean;
};

export type WizardItem = {
  catalog_product_id: string;
  config?: Record<string, unknown>;
  sort_order: number;
};

type ProductPackageWizardProps = {
  catalog: CatalogProduct[];
  feeScheduleRates?: Record<string, Record<string, number>>;
  wizardStep: number;
  setWizardStep: (n: number) => void;
  wizardItems: WizardItem[];
  setWizardItems: (items: WizardItem[]) => void;
  wizardName: string;
  setWizardName: (s: string) => void;
  wizardDesc: string;
  setWizardDesc: (s: string) => void;
  wizardError: string | null;
  setWizardError: (s: string | null) => void;
  onCancel: () => void;
  onSuccess: (uid: string) => void;
  createPackage: (payload: { name: string; description?: string; items: WizardItem[] }) => Promise<{ uid?: string } | { error: string }>;
};

export function ProductPackageWizard({
  catalog,
  feeScheduleRates = {},
  wizardStep,
  setWizardStep,
  wizardItems,
  setWizardItems,
  wizardName,
  setWizardName,
  wizardDesc,
  setWizardDesc,
  wizardError,
  setWizardError,
  onCancel,
  onSuccess,
  createPackage,
}: ProductPackageWizardProps) {
  const physicalPos = catalog.filter((c) => c.product_type === "physical_pos");
  const ecomm = catalog.filter((c) => c.product_type === "ecomm");
  const acquiring = catalog.filter((c) => c.product_type === "acquiring");
  const otherFee = catalog.filter((c) => c.product_type === "other_fee");

  const [acquiringPctDisplay, setAcquiringPctDisplay] = useState<Record<string, string>>({});
  const [ecommAmountDisplay, setEcommAmountDisplay] = useState<Record<string, string>>({});

  const getMinPct = (code: string) => {
    const r = feeScheduleRates[code];
    if (r && typeof r.min_pct === "number") return r.min_pct;
    const p = catalog.find((c) => c.product_code === code);
    const min = p?.config_schema?.min_pct;
    return typeof min === "number" ? min : 0;
  };
  const getMinAmount = (code: string) => {
    const r = feeScheduleRates[code];
    if (r && typeof r.min_amount === "number") return r.min_amount;
    const p = catalog.find((c) => c.product_code === code);
    const min = p?.config_schema?.min_amount;
    return typeof min === "number" ? min : 0;
  };
  const getMinPerMonth = (code: string) => {
    const r = feeScheduleRates[code];
    if (r && typeof r.min_per_month === "number") return r.min_per_month;
    return code === "softpos" ? 10 : 20;
  };
  const getMinPerDevice = (code: string) => {
    const r = feeScheduleRates[code];
    if (r && typeof r.min_per_device === "number") return r.min_per_device;
    return 250;
  };
  const getMinService = (code: string) => {
    const r = feeScheduleRates[code];
    if (r && typeof r.min_service === "number") return r.min_service;
    return 5;
  };

  function validateCurrentStep(): string | null {
    for (const item of wizardItems) {
      const cat = catalog.find((c) => c.id === item.catalog_product_id);
      if (!cat) continue;
      const cfg = item.config ?? {};
      if (cat.product_type === "physical_pos") {
        if (cfg.pos_pricing_type === "per_month") {
          const min = getMinPerMonth(cat.product_code);
          const v = (cfg.pos_price_per_month as number) ?? min;
          if (v < min) {
            return `${cat.name}: Price per month must be at least £${min}.`;
          }
        } else if (cfg.pos_pricing_type === "per_device_service") {
          const minD = getMinPerDevice(cat.product_code);
          const minS = getMinService(cat.product_code);
          const vd = (cfg.pos_price_per_device as number) ?? minD;
          const vs = (cfg.pos_monthly_service as number) ?? minS;
          if (vd < minD) {
            return `${cat.name}: Price per device must be at least £${minD}.`;
          }
          if (vs < minS) {
            return `${cat.name}: Monthly service must be at least £${minS}.`;
          }
        }
      }
      if (cat.product_type === "ecomm") {
        const min = getMinAmount(cat.product_code) || 0.2;
        const rawAmt = ecommAmountDisplay[item.catalog_product_id] ?? (cfg.amount != null ? String(cfg.amount) : "");
        const amtVal = rawAmt === "" ? min : (parseFloat(rawAmt) ?? min);
        if (amtVal < min) {
          const unit = cat.product_code === "payby_link" ? "link" : "QR code";
          return `${cat.name}: Fee must be at least £${min.toFixed(2)} per ${unit}.`;
        }
      }
      if (cat.product_type === "acquiring") {
        const min = getMinPct(cat.product_code);
        const rawPct = acquiringPctDisplay[item.catalog_product_id] ?? (cfg.pct != null ? String(cfg.pct) : "");
        const pctVal = rawPct === "" ? min : (parseFloat(rawPct) ?? min);
        if (pctVal < min) {
          return `${cat.name}: Rate must be at least ${min}%.`;
        }
      }
      if (cat.product_type === "other_fee" && cfg.amount != null) {
        const min = getMinAmount(cat.product_code);
        if ((cfg.amount as number) < min) {
          return `${cat.name}: Fee must be at least £${min.toFixed(2)}.`;
        }
      }
    }
    return null;
  }

  function validateStepBeforeAdvance(fromStep: number): boolean {
    if (fromStep === 1 || fromStep === 2) {
      const err = validateCurrentStep();
      if (err) {
        setWizardError(err);
        return false;
      }
    }
    if (fromStep === 3) {
      const err = validateCurrentStep();
      if (err) {
        setWizardError(err);
        return false;
      }
    }
    if (fromStep === 4) {
      const err = validateCurrentStep();
      if (err) {
        setWizardError(err);
        return false;
      }
    }
    return true;
  }

  const handleSave = async () => {
    setWizardError(null);
    if (!wizardName.trim()) {
      setWizardError("Package name is required.");
      return;
    }
    const validationErr = validateCurrentStep();
    if (validationErr) {
      setWizardError(validationErr);
      return;
    }
    const res = await createPackage({
      name: wizardName.trim(),
      description: wizardDesc.trim() || undefined,
      items: wizardItems,
    });
    if ("error" in res) {
      setWizardError(res.error);
      return;
    }
    if (res.uid) onSuccess(res.uid);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-path-p2">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={wizardStep === s ? "font-bold text-path-primary" : "text-path-grey-500"}>
            Step {s}
          </span>
        ))}
      </div>
      {wizardError && <p className="text-path-p2 text-path-secondary">{wizardError}</p>}

      {wizardStep === 1 && (
        <div>
          <h3 className="font-medium mb-2">Physical POS</h3>
          <p className="text-path-p2 text-path-grey-600 mb-2">Include device types and set pricing. Quantity is set when generating the boarding link.</p>
          <div className="space-y-4">
            {physicalPos.map((p) => {
              const existing = wizardItems.find((i) => i.catalog_product_id === p.id);
              const enabled = !!existing;
              const isSoftPos = p.product_code === "softpos";
              const pricingType = (existing?.config?.pos_pricing_type as string) ?? (isSoftPos ? "per_month" : "per_month");
              const minPerMonth = getMinPerMonth(p.product_code);
              const minPerDevice = getMinPerDevice(p.product_code);
              const minService = getMinService(p.product_code);
              const pricePerMonth = (existing?.config?.pos_price_per_month as number) ?? minPerMonth;
              const pricePerDevice = (existing?.config?.pos_price_per_device as number) ?? minPerDevice;
              const monthlyService = (existing?.config?.pos_monthly_service as number) ?? minService;
              return (
                <div key={p.id} className="p-3 border border-path-grey-200 rounded-lg space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 font-medium">{p.name}</label>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const so = wizardItems.length > 0 ? Math.max(...wizardItems.map((i) => i.sort_order)) + 1 : 0;
                          const cfg: Record<string, unknown> = { enabled: true, pos_pricing_type: isSoftPos ? "per_month" : "per_month", pos_price_per_month: minPerMonth };
                          if (!isSoftPos) cfg.pos_price_per_device = minPerDevice;
                          if (!isSoftPos) cfg.pos_monthly_service = minService;
                          setWizardItems([...wizardItems, { catalog_product_id: p.id, config: cfg, sort_order: so }]);
                        } else {
                          setWizardItems(wizardItems.filter((i) => i.catalog_product_id !== p.id));
                        }
                      }}
                    />
                  </div>
                  {enabled && (
                    <div className="pl-4 border-l-2 border-path-grey-200 space-y-2">
                      {!isSoftPos && (
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`pos-pricing-${p.id}`}
                              checked={pricingType === "per_month"}
                              onChange={() => {
                                const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                                const so = existing?.sort_order ?? others.length;
                                setWizardItems([...others, { catalog_product_id: p.id, config: { enabled: true, pos_pricing_type: "per_month", pos_price_per_month: pricePerMonth }, sort_order: so }]);
                              }}
                            />
                            Price per month
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`pos-pricing-${p.id}`}
                              checked={pricingType === "per_device_service"}
                              onChange={() => {
                                const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                                const so = existing?.sort_order ?? others.length;
                                setWizardItems([...others, { catalog_product_id: p.id, config: { enabled: true, pos_pricing_type: "per_device_service", pos_price_per_device: pricePerDevice, pos_monthly_service: monthlyService }, sort_order: so }]);
                              }}
                            />
                            Price per device + Monthly service
                          </label>
                        </div>
                      )}
                      {pricingType === "per_month" && (
                        <div className="flex items-center gap-2">
                          <span className="text-path-p2">£</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={String(pricePerMonth)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const v = raw === "" ? minPerMonth : (parseFloat(raw) ?? minPerMonth);
                              const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                              const so = existing?.sort_order ?? others.length;
                              const cfg: Record<string, unknown> = { enabled: true, pos_pricing_type: "per_month", pos_price_per_month: v };
                              setWizardItems([...others, { catalog_product_id: p.id, config: cfg, sort_order: so }]);
                            }}
                            className="w-24 border border-path-grey-300 rounded px-2 py-1"
                          />
                          <span className="text-path-p2">per month</span>
                        </div>
                      )}
                      {!isSoftPos && pricingType === "per_device_service" && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-path-p2">£</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={String(pricePerDevice)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const v = raw === "" ? minPerDevice : (parseFloat(raw) ?? minPerDevice);
                                const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                                const so = existing?.sort_order ?? others.length;
                                setWizardItems([...others, { catalog_product_id: p.id, config: { enabled: true, pos_pricing_type: "per_device_service", pos_price_per_device: v, pos_monthly_service: monthlyService }, sort_order: so }]);
                              }}
                              className="w-24 border border-path-grey-300 rounded px-2 py-1"
                            />
                            <span className="text-path-p2">per device</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-path-p2">£</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={String(monthlyService)}
                              onChange={(e) => {
                                const raw = e.target.value;
                                const v = raw === "" ? minService : (parseFloat(raw) ?? minService);
                                const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                                const so = existing?.sort_order ?? others.length;
                                setWizardItems([...others, { catalog_product_id: p.id, config: { enabled: true, pos_pricing_type: "per_device_service", pos_price_per_device: pricePerDevice, pos_monthly_service: v }, sort_order: so }]);
                              }}
                              className="w-24 border border-path-grey-300 rounded px-2 py-1"
                            />
                            <span className="text-path-p2">monthly service</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div>
          <h3 className="font-medium mb-2">Ecommerce</h3>
          <p className="text-path-p2 text-path-grey-600 mb-2">Enable ecommerce products and set per-unit fees.</p>
          <div className="space-y-4">
            {ecomm.map((p) => {
              const existing = wizardItems.find((i) => i.catalog_product_id === p.id);
              const enabled = !!existing;
              const minAmt = getMinAmount(p.product_code) || 0.2;
              const amount = (existing?.config?.amount as number) ?? minAmt;
              const unitLabel = p.product_code === "payby_link" ? "per link" : "per QR code";
              return (
                <div key={p.id} className="p-3 border border-path-grey-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-4">
                    <label className="flex-1 font-medium">{p.name}</label>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const so = wizardItems.length > 0 ? Math.max(...wizardItems.map((i) => i.sort_order)) + 1 : 0;
                          setWizardItems([...wizardItems, { catalog_product_id: p.id, config: { enabled: true, amount: minAmt }, sort_order: so }]);
                        } else {
                          setWizardItems(wizardItems.filter((i) => i.catalog_product_id !== p.id));
                        }
                      }}
                    />
                  </div>
                  {enabled && (
                    <div className="pl-4 border-l-2 border-path-grey-200 flex items-center gap-2">
                      <span className="text-path-p2">£</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ecommAmountDisplay[p.id] ?? String(amount)}
                        onChange={(e) => setEcommAmountDisplay((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onBlur={() => {
                          const raw = ecommAmountDisplay[p.id] ?? String(amount);
                          const parsed = raw === "" ? minAmt : (parseFloat(raw) ?? minAmt);
                          const final = Math.max(minAmt, parsed);
                          setEcommAmountDisplay((prev) => {
                            const next = { ...prev };
                            delete next[p.id];
                            return next;
                          });
                          const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                          const so = existing?.sort_order ?? others.length;
                          setWizardItems([...others, { catalog_product_id: p.id, config: { enabled: true, amount: final }, sort_order: so }]);
                        }}
                        className="w-24 border border-path-grey-300 rounded px-2 py-1"
                      />
                      <span className="text-path-p2">{unitLabel}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div>
          <h3 className="font-medium mb-2">Acquiring pricing (%)</h3>
          <p className="text-path-p2 text-path-grey-600 mb-2">Set percentage for each.</p>
          <div className="space-y-2">
            {acquiring.map((p) => {
              const existing = wizardItems.find((i) => i.catalog_product_id === p.id);
              const minPct = getMinPct(p.product_code);
              const pct = (existing?.config?.pct as number) ?? minPct;
              const displayVal = acquiringPctDisplay[p.id] ?? String(pct);
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <label className="flex-1">{p.name}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={displayVal}
                    onChange={(e) => setAcquiringPctDisplay((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onBlur={() => {
                      const raw = acquiringPctDisplay[p.id] ?? String(pct);
                      const parsed = raw === "" ? minPct : (parseFloat(raw) ?? minPct);
                      const final = Math.max(minPct, parsed);
                      setAcquiringPctDisplay((prev) => {
                        const next = { ...prev };
                        delete next[p.id];
                        return next;
                      });
                      const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                      const so = existing?.sort_order ?? (others.length > 0 ? Math.max(...others.map((i) => i.sort_order)) + 1 : 0);
                      setWizardItems([...others, { catalog_product_id: p.id, config: { pct: final }, sort_order: so }]);
                    }}
                    placeholder={String(minPct)}
                    className="w-24 border border-path-grey-300 rounded px-2 py-1"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wizardStep === 4 && (
        <div>
          <h3 className="font-medium mb-2">Other fees (£)</h3>
          <p className="text-path-p2 text-path-grey-600 mb-2">Set amount for each.</p>
          <div className="space-y-2">
            {otherFee.map((p) => {
              const existing = wizardItems.find((i) => i.catalog_product_id === p.id);
              const minAmt = getMinAmount(p.product_code);
              const amt = (existing?.config?.amount as number) ?? minAmt;
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <label className="flex-1">{p.name}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(amt)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const v = raw === "" ? minAmt : (parseFloat(raw) ?? minAmt);
                      const others = wizardItems.filter((i) => i.catalog_product_id !== p.id);
                      const so = others.length > 0 ? Math.max(...others.map((i) => i.sort_order)) + 1 : 0;
                      setWizardItems([...others, { catalog_product_id: p.id, config: { amount: v }, sort_order: so }]);
                    }}
                    placeholder={minAmt.toFixed(2)}
                    className="w-24 border border-path-grey-300 rounded px-2 py-1"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {wizardStep === 5 && (
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Package name</label>
            <input
              type="text"
              value={wizardName}
              onChange={(e) => setWizardName(e.target.value)}
              placeholder="e.g. Standard Retail"
              className="w-full border border-path-grey-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Description (optional)</label>
            <textarea
              value={wizardDesc}
              onChange={(e) => setWizardDesc(e.target.value)}
              placeholder="Brief description"
              className="w-full border border-path-grey-300 rounded-lg px-3 py-2"
              rows={2}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-4">
        {wizardStep > 1 && (
          <button type="button" onClick={() => setWizardStep(wizardStep - 1)} className="px-4 py-2 border border-path-grey-300 rounded-lg">
            Back
          </button>
        )}
        {wizardStep < 5 ? (
          <button
            type="button"
            onClick={() => {
              if (!validateStepBeforeAdvance(wizardStep)) return;
              setWizardError(null);
              let nextItems = wizardItems;
              if (wizardStep === 2) {
                setEcommAmountDisplay({});
                nextItems = nextItems.map((it) => {
                  const p = ecomm.find((e) => e.id === it.catalog_product_id);
                  if (!p) return it;
                  const raw = ecommAmountDisplay[p.id];
                  if (raw === undefined) return it;
                  const minAmt = getMinAmount(p.product_code) || 0.2;
                  const parsed = raw === "" ? minAmt : (parseFloat(raw) ?? minAmt);
                  const final = Math.max(minAmt, parsed);
                  return { ...it, config: { ...it.config, amount: final } };
                });
                const so = nextItems.length;
                const toAdd = acquiring.filter((a) => !nextItems.some((i) => i.catalog_product_id === a.id));
                if (toAdd.length > 0) {
                  nextItems = [
                    ...nextItems,
                    ...toAdd.map((a, i) => ({
                      catalog_product_id: a.id,
                      config: { pct: getMinPct(a.product_code) },
                      sort_order: so + i,
                    })),
                  ];
                }
              } else if (wizardStep === 3) {
                setAcquiringPctDisplay({});
                nextItems = nextItems.map((it) => {
                  const p = acquiring.find((a) => a.id === it.catalog_product_id);
                  if (!p) return it;
                  const raw = acquiringPctDisplay[p.id];
                  if (raw === undefined) return it;
                  const minPct = getMinPct(p.product_code);
                  const parsed = raw === "" ? minPct : (parseFloat(raw) ?? minPct);
                  const final = Math.max(minPct, parsed);
                  return { ...it, config: { ...it.config, pct: final } };
                });
                const so = nextItems.length;
                const toAdd = otherFee.filter((o) => !nextItems.some((i) => i.catalog_product_id === o.id));
                if (toAdd.length > 0) {
                  nextItems = [
                    ...nextItems,
                    ...toAdd.map((o, i) => ({
                      catalog_product_id: o.id,
                      config: { amount: getMinAmount(o.product_code) },
                      sort_order: so + i,
                    })),
                  ];
                }
              }
              if (nextItems !== wizardItems) setWizardItems(nextItems);
              setWizardStep(wizardStep + 1);
            }}
            className="px-4 py-2 bg-path-primary text-white rounded-lg"
          >
            Next
          </button>
        ) : (
          <button type="button" onClick={handleSave} className="px-4 py-2 bg-path-primary text-white rounded-lg">
            Save package
          </button>
        )}
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-path-grey-300 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}
