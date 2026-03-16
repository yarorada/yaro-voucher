import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";

interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
}

export interface DuplicateSupplier extends Supplier {}

interface CheckResult {
  duplicates: DuplicateSupplier[];
  hasSameName: boolean;
  hasSameEmail: boolean;
  hasSamePhone: boolean;
}

/**
 * Returns potential duplicate suppliers based on:
 * 1. Same name (diacritic-insensitive, exact or very close)
 * 2. Same email
 * 3. Same phone (digits-only comparison)
 */
export async function checkSupplierDuplicates(
  name: string,
  email: string,
  phone: string,
  excludeId?: string
): Promise<CheckResult> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, email, phone, city");

  if (error || !data) return { duplicates: [], hasSameName: false, hasSameEmail: false, hasSamePhone: false };

  const normalizedName = removeDiacritics(name.trim().toLowerCase());
  const normalizedEmail = email.trim().toLowerCase();
  const digitsOnly = (s: string) => s.replace(/\D/g, "");
  const phoneDigits = digitsOnly(phone.trim());

  const found: DuplicateSupplier[] = [];
  let hasSameName = false, hasSameEmail = false, hasSamePhone = false;

  for (const s of data as Supplier[]) {
    if (s.id === excludeId) continue;

    const sName = removeDiacritics(s.name.trim().toLowerCase());
    const sEmail = (s.email || "").trim().toLowerCase();
    const sPhoneDigits = digitsOnly(s.phone || "");

    const nameMatch = sName === normalizedName;
    const emailMatch = normalizedEmail.length > 4 && sEmail === normalizedEmail;
    const phoneMatch = phoneDigits.length >= 7 && sPhoneDigits === phoneDigits;

    if (nameMatch || emailMatch || phoneMatch) {
      found.push(s);
      if (nameMatch) hasSameName = true;
      if (emailMatch) hasSameEmail = true;
      if (phoneMatch) hasSamePhone = true;
    }
  }

  return { duplicates: found, hasSameName, hasSameEmail, hasSamePhone };
}
