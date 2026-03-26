"use client";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const PRESETS = [
  { label: "Holographic Blue", value: "#00d4ff" },
  { label: "Cyan", value: "#00ffcc" },
  { label: "Violet", value: "#a855f7" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Gold", value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "White", value: "#e2e8f0" },
  { label: "Coral", value: "#ff6b6b" },
];

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
        Sphere Color
      </p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.value}
            title={preset.label}
            onClick={() => onChange(preset.value)}
            className={`
              h-7 w-7 rounded-full border-2 transition-all duration-200
              hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1
              ${
                color === preset.value
                  ? "border-gray-900 scale-110 shadow-lg"
                  : "border-transparent hover:border-gray-300"
              }
            `}
            style={{ backgroundColor: preset.value }}
          />
        ))}
        <label
          title="Custom color"
          className="relative h-7 w-7 cursor-pointer rounded-full border-2 border-dashed border-gray-300 hover:border-gray-500 transition-all duration-200 hover:scale-110 flex items-center justify-center overflow-hidden"
        >
          <span className="text-gray-400 text-xs font-bold leading-none">+</span>
          <input
            type="color"
            value={color}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </label>
      </div>
    </div>
  );
}
