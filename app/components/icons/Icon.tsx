import { createElement } from "react";
import type { SVGProps } from "react";

/**
 * Inline SVG icons for the public marketing pages.
 *
 * Geometry is lucide-react's (ISC, already a dependency), so these match the icon
 * language the dashboard already uses. They are emitted as plain SVG rather than
 * imported from lucide-react because lucide's Icon module carries "use client",
 * which would pull a client bundle into statically rendered SEO pages.
 *
 * Every icon here is decorative - the adjacent text always carries the meaning -
 * so each is aria-hidden and kept out of the accessibility tree.
 */
const NODES = {
  "building-2": [["path", {"d": "M10 12h4"}], ["path", {"d": "M10 8h4"}], ["path", {"d": "M14 21v-3a2 2 0 0 0-4 0v3"}], ["path", {"d": "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"}], ["path", {"d": "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"}]],
  "sunset": [["path", {"d": "M12 10V2"}], ["path", {"d": "m4.93 10.93 1.41 1.41"}], ["path", {"d": "M2 18h2"}], ["path", {"d": "M20 18h2"}], ["path", {"d": "m19.07 10.93-1.41 1.41"}], ["path", {"d": "M22 22H2"}], ["path", {"d": "m16 6-4 4-4-4"}], ["path", {"d": "M16 18a4 4 0 0 0-8 0"}]],
  "house": [["path", {"d": "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"}], ["path", {"d": "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"}]],
  "landmark": [["path", {"d": "M10 18v-7"}], ["path", {"d": "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"}], ["path", {"d": "M14 18v-7"}], ["path", {"d": "M18 18v-7"}], ["path", {"d": "M3 22h18"}], ["path", {"d": "M6 18v-7"}]],
  "castle": [["path", {"d": "M10 5V3"}], ["path", {"d": "M14 5V3"}], ["path", {"d": "M15 21v-3a3 3 0 0 0-6 0v3"}], ["path", {"d": "M18 3v8"}], ["path", {"d": "M18 5H6"}], ["path", {"d": "M22 11H2"}], ["path", {"d": "M22 9v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9"}], ["path", {"d": "M6 3v8"}]],
  "waves": [["path", {"d": "M2 12q2.5 2 5 0t5 0 5 0 5 0"}], ["path", {"d": "M2 19q2.5 2 5 0t5 0 5 0 5 0"}], ["path", {"d": "M2 5q2.5 2 5 0t5 0 5 0 5 0"}]],
  "cog": [["path", {"d": "M11 10.27 7 3.34"}], ["path", {"d": "m11 13.73-4 6.93"}], ["path", {"d": "M12 22v-2"}], ["path", {"d": "M12 2v2"}], ["path", {"d": "M14 12h8"}], ["path", {"d": "m17 20.66-1-1.73"}], ["path", {"d": "m17 3.34-1 1.73"}], ["path", {"d": "M2 12h2"}], ["path", {"d": "m20.66 17-1.73-1"}], ["path", {"d": "m20.66 7-1.73 1"}], ["path", {"d": "m3.34 17 1.73-1"}], ["path", {"d": "m3.34 7 1.73 1"}], ["circle", {"cx": "12", "cy": "12", "r": "2"}], ["circle", {"cx": "12", "cy": "12", "r": "8"}]],
  "music": [["path", {"d": "M9 18V5l12-2v13"}], ["circle", {"cx": "6", "cy": "18", "r": "3"}], ["circle", {"cx": "18", "cy": "16", "r": "3"}]],
  "target": [["circle", {"cx": "12", "cy": "12", "r": "10"}], ["circle", {"cx": "12", "cy": "12", "r": "6"}], ["circle", {"cx": "12", "cy": "12", "r": "2"}]],
  "smartphone": [["rect", {"width": "14", "height": "20", "x": "5", "y": "2", "rx": "2", "ry": "2"}], ["path", {"d": "M12 18h.01"}]],
  "message-circle": [["path", {"d": "M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"}]],
  "pound-sterling": [["path", {"d": "M18 7c0-5.333-8-5.333-8 0"}], ["path", {"d": "M10 7v14"}], ["path", {"d": "M6 21h12"}], ["path", {"d": "M6 13h10"}]],
  "users": [["path", {"d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}], ["path", {"d": "M16 3.128a4 4 0 0 1 0 7.744"}], ["path", {"d": "M22 21v-2a4 4 0 0 0-3-3.87"}], ["circle", {"cx": "9", "cy": "7", "r": "4"}]],
  "credit-card": [["rect", {"width": "20", "height": "14", "x": "2", "y": "5", "rx": "2"}], ["line", {"x1": "2", "x2": "22", "y1": "10", "y2": "10"}]],
  "chart-column": [["path", {"d": "M3 3v16a2 2 0 0 0 2 2h16"}], ["path", {"d": "M18 17V9"}], ["path", {"d": "M13 17V5"}], ["path", {"d": "M8 17v-3"}]],
  "map-pin": [["path", {"d": "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}], ["circle", {"cx": "12", "cy": "10", "r": "3"}]],
  "check": [["path", {"d": "M20 6 9 17l-5-5"}]],
} as const;

export type IconName = keyof typeof NODES;

type IconProps = { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">;

export function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {NODES[name].map((node, i) =>
        createElement(node[0] as string, { ...(node[1] as object), key: i })
      )}
    </svg>
  );
}
