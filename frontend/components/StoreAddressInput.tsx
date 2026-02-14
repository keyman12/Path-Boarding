"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/api";

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
function isValidUkPostcode(value: string): boolean {
  return UK_POSTCODE_REGEX.test(value.trim().replace(/\s+/g, " "));
}

type AddressLookupResult = { addressLine1: string; addressLine2: string; town: string; postcode: string };

type StoreAddressInputProps = {
  postcode: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  onPostcodeChange: (v: string) => void;
  onAddressChange: (a: { addressLine1: string; addressLine2: string; town: string }) => void;
  disabled?: boolean;
  label?: string;
};

const inputClassName = "w-full border border-path-grey-300 rounded-lg px-3 py-2 text-path-p1 h-11";

export function StoreAddressInput({
  postcode,
  addressLine1,
  addressLine2,
  town,
  onPostcodeChange,
  onAddressChange,
  disabled,
  label,
}: StoreAddressInputProps) {
  const [lookupResults, setLookupResults] = useState<AddressLookupResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLookup = useCallback(async (pc: string) => {
    if (!pc || !isValidUkPostcode(pc)) return;
    setLookupError(null);
    setLookupLoading(true);
    setLookupResults([]);
    try {
      const res = await apiGet<AddressLookupResult[]>(
        `/boarding/address-lookup?postcode=${encodeURIComponent(pc.trim())}`
      );
      if (res.error) {
        setLookupError(typeof res.error === "string" ? res.error : "Could not load addresses.");
        return;
      }
      const list = Array.isArray(res.data) ? res.data : [];
      setLookupResults(list);
      if (list.length === 0) setLookupError("No addresses found for this postcode.");
    } catch {
      setLookupError("Could not load addresses. Enter manually.");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    const pc = postcode.trim();
    if (!pc || !isValidUkPostcode(pc)) {
      setLookupResults([]);
      setLookupError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchLookup(pc), 400);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [postcode, fetchLookup]);

  return (
    <div className="space-y-2">
      {label && <p className="text-path-p2 font-medium text-path-grey-700">{label}</p>}
      <div>
        <input
          type="text"
          value={postcode}
          onChange={(e) => {
            onPostcodeChange(e.target.value);
            setLookupError(null);
            setLookupResults([]);
          }}
          placeholder="Postcode (enter first)"
          disabled={disabled}
          className={inputClassName}
          autoComplete="postal-code"
        />
      </div>
      {lookupLoading && <p className="text-path-p2 text-path-grey-600 text-sm">Loading addresses…</p>}
      {lookupError && !lookupLoading && <p className="text-path-p2 text-path-secondary text-sm">{lookupError}</p>}
      {lookupResults.length > 0 && !lookupLoading && (
        <div>
          <label className="block text-path-p2 font-medium text-path-grey-700 mb-1">Select address</label>
          <select
            className={inputClassName}
            value=""
            onChange={(e) => {
              const idx = e.target.value ? parseInt(e.target.value, 10) : -1;
              if (idx >= 0 && lookupResults[idx]) {
                const a = lookupResults[idx];
                onAddressChange({
                  addressLine1: a.addressLine1,
                  addressLine2: a.addressLine2 || "",
                  town: a.town,
                });
                setLookupResults([]);
                setLookupError(null);
              }
            }}
          >
            <option value="">Select your address</option>
            {lookupResults.map((a, i) => (
              <option key={i} value={i}>
                {[a.addressLine1, a.town, a.postcode].filter(Boolean).join(", ")}
              </option>
            ))}
          </select>
        </div>
      )}
      <input
        type="text"
        value={addressLine1}
        onChange={(e) => onAddressChange({ addressLine1: e.target.value, addressLine2, town })}
        placeholder="Address Line 1"
        disabled={disabled}
        className={inputClassName}
      />
      <input
        type="text"
        value={addressLine2}
        onChange={(e) => onAddressChange({ addressLine1, addressLine2: e.target.value, town })}
        placeholder="Address Line 2"
        disabled={disabled}
        className={inputClassName}
      />
      <input
        type="text"
        value={town}
        onChange={(e) => onAddressChange({ addressLine1, addressLine2, town: e.target.value })}
        placeholder="Town"
        disabled={disabled}
        className={inputClassName}
      />
    </div>
  );
}
