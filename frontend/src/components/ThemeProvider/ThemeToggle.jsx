import React, { useContext } from "react";
import { Moon, Sun } from "lucide-react";
import { ThemeContext } from "./ThemeProvider";

export default function ThemeToggle({ className = "" }) {
  const { dark, toggle } = useContext(ThemeContext);

  return (
    <div
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      className={`flex items-center cursor-pointer w-11 h-6 rounded-full transition-colors duration-300 p-0.5 shadow-inner ${
        dark ? "bg-purple-600" : "bg-gray-300"
      } ${className}`}
      title={dark ? "Switch to Day mode" : "Switch to Night mode"}
    >
      <div
        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${
          dark ? "translate-x-5" : "translate-x-0"
        }`}
      >
        {dark ? (
          <Moon className="w-3 h-3 text-purple-600" />
        ) : (
          <Sun className="w-3 h-3 text-yellow-400" />
        )}
      </div>
    </div>
  );
} 