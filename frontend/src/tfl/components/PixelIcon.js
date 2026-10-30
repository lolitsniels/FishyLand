import { PIXEL_ICONS } from "./pixelIconData";

const toPath = (rows, ch) => rows.flatMap((r, y) => [...r].map((c, x) => (c === ch ? `M${x} ${y}h1v1h-1z` : ""))).join("");
const cache = {};
const paths = (name) => (cache[name] ||= [toPath(PIXEL_ICONS[name], "#"), toPath(PIXEL_ICONS[name], "o")]);

export function PixelIcon({ name, size = 16, className = "", ...rest }) {
  const [solid, half] = paths(name);
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" shapeRendering="crispEdges" className={`px-icon ${className}`} aria-hidden="true" {...rest}>
      <path d={solid} /><path d={half} opacity=".45" />
    </svg>
  );
}

// Drop-in replacement for a lucide icon component.
export const pixelIcon = (name) => {
  const C = (p) => <PixelIcon name={name} {...p} />;
  C.displayName = `PixelIcon(${name})`;
  return C;
};
