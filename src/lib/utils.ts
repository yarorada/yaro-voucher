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

export function formatPrice(price: number | null | undefined, showCurrency = true): string {
  if (price === null || price === undefined) return "-";
  const formatted = new Intl.NumberFormat("cs-CZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
  return showCurrency ? `${formatted} Kč` : formatted;
}

export function formatPriceCurrency(price: number | null | undefined): string {
  if (price === null || price === undefined) return "-";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}
