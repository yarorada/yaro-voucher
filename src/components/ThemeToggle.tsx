import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    const initialTheme = savedTheme || "system";
    
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", prefersDark);
    } else {
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    }
  };

  const toggleTheme = () => {
    const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const currentIndex = themes.indexOf(theme);
    const newTheme = themes[(currentIndex + 1) % themes.length];
    
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const getIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />;
      case "dark":
        return <Moon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />;
      case "system":
        return <Monitor className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case "light":
        return "Světlý režim";
      case "dark":
        return "Tmavý režim";
      case "system":
        return "Systémový režim";
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 w-full px-2 py-2 rounded-md hover:bg-accent/50 transition-all duration-200 group"
      aria-label="Přepnout režim vzhledu"
    >
      {getIcon()}
      <span className="font-medium">{getLabel()}</span>
    </button>
  );
}
