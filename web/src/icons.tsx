// Line icons for the home type tiles: a 24px grid, 1.5px stroke, square caps, currentColor.
// Always beside a word, so they are aria-hidden. A type the site has no icon for gets the generic one.
const paths: Record<string, string> = {
  all: "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  language: "M4 5h16v11H11l-4.5 3.5V16H4z",
  code: "M9 7l-5 5 5 5M15 7l5 5-5 5",
  vision: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.25a2.75 2.75 0 100 5.5 2.75 2.75 0 000-5.5z",
  image: "M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 3-3 5 5M15.5 9.5h.01",
  video: "M3 6h18v12H3zM10 9.5v5l4.5-2.5z",
  audio: "M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4",
  "3d": "M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  generic: "M5 5h4v4H5zM15 5h4v4h-4zM5 15h4v4H5zM15 15h4v4h-4z",
};

export function TypeIcon({ id }: { id: string }) {
  return (
    <svg className="type-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false">
      <path d={paths[id] ?? paths.generic} />
    </svg>
  );
}
