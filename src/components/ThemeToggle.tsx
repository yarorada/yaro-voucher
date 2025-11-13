import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-accent/50 transition-all duration-200 group"
      aria-label="Přepnout tmavý režim"
    >
      {theme === "light" ? (
        <>
          <Moon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          <span className="font-medium">Tmavý režim</span>
        </>
      ) : (
        <>
          <Sun className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          <span className="font-medium">Světlý režim</span>
        </>
      )}
    </button>
  );
}
