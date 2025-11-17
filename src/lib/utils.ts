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
