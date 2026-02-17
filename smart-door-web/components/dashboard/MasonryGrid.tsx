'use client';

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';

interface MasonryGridProps {
  children: ReactNode[];
  columnMinWidth?: number;
  gap?: number;
}

export function MasonryGrid({ children, columnMinWidth = 340, gap = 20 }: MasonryGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(3);

  const updateColumns = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    const cols = Math.max(1, Math.floor((width + gap) / (columnMinWidth + gap)));
    setColumns(cols);
  }, [columnMinWidth, gap]);

  useEffect(() => {
    updateColumns();
    const observer = new ResizeObserver(updateColumns);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateColumns]);

  // Distribute children across columns (shortest-column-first for balanced height)
  const columnItems: ReactNode[][] = Array.from({ length: columns }, () => []);
  const columnHeights = new Array(columns).fill(0);

  // Estimated heights for balanced distribution
  const items = Array.isArray(children) ? children : [children];
  items.forEach((child) => {
    const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));
    columnItems[shortestCol].push(child);
    // Use uniform estimate since we can't measure before render; items will auto-size
    columnHeights[shortestCol] += 1;
  });

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        gap: `${gap}px`,
        alignItems: 'flex-start',
      }}
    >
      {columnItems.map((colChildren, colIndex) => (
        <div
          key={colIndex}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: `${gap}px`,
            minWidth: 0,
          }}
        >
          {colChildren}
        </div>
      ))}
    </div>
  );
}
