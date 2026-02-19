import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function translateTitleToEnglish(title: string | null): string {
  if (!title) return "";
  const normalized = title.toLowerCase().trim();
  if (normalized === "pan" || normalized === "mr" || normalized === "mr.") return "Mr.";
  if (normalized === "paní" || normalized === "mrs" || normalized === "mrs." || normalized === "ms" || normalized === "ms.") return "Mrs.";
  return title;
}

export function formatPrice(price: number | null | undefined, showCurrency = true, currencyCode = "CZK"): string {
  if (price === null || price === undefined) return "-";
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
  if (!showCurrency) return formatted;
  const symbols: Record<string, string> = { CZK: "Kč", EUR: "€", USD: "$", GBP: "£" };
  return `${formatted} ${symbols[currencyCode] || currencyCode}`;
}

export function formatPriceCurrency(price: number | null | undefined, currencyCode = "CZK"): string {
  if (price === null || price === undefined) return "-";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Formats a Date object to YYYY-MM-DD string for database storage.
 * Avoids timezone issues by using local date components.
 */
export function formatDateForDB(date: Date | undefined | null): string | null {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Capitalizes each word in a string (e.g., "jan pavel" -> "Jan Pavel")
 */
export function capitalizeWords(str: string): string {
  if (!str) return "";
  return str
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Safely parses a "YYYY-MM-DD" date string from the database into a local Date object.
 * Avoids UTC interpretation that can shift dates in negative-offset timezones.
 */
export function parseDateSafe(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

/**
 * Formats a "YYYY-MM-DD" database date string as "DD.MM.YYYY" for display.
 * Uses local date parsing to avoid timezone shifts.
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const date = parseDateSafe(dateStr);
  if (!date) return "-";
  return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
}
