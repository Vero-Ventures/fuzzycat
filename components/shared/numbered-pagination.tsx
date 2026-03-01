'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NumberedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface PageItem {
  type: 'page';
  page: number;
}

interface EllipsisItem {
  type: 'ellipsis';
  key: string;
}

type PaginationItem = PageItem | EllipsisItem;

/**
 * Builds the array of page items to display, with ellipsis gaps.
 * E.g. [1, 2, '...', 5, 6, 7, '...', 10]
 */
function getPageItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => ({ type: 'page' as const, page: i + 1 }));
  }

  const items: PaginationItem[] = [{ type: 'page', page: 1 }];

  if (currentPage > 3) {
    items.push({ type: 'ellipsis', key: 'start' });
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    items.push({ type: 'page', page: i });
  }

  if (currentPage < totalPages - 2) {
    items.push({ type: 'ellipsis', key: 'end' });
  }

  items.push({ type: 'page', page: totalPages });

  return items;
}

export function NumberedPagination({
  currentPage,
  totalPages,
  onPageChange,
}: NumberedPaginationProps) {
  if (totalPages <= 1) return null;

  const items = getPageItems(currentPage, totalPages);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {items.map((item) =>
        item.type === 'ellipsis' ? (
          <span key={item.key} className="px-2 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Button
            key={item.page}
            variant={item.page === currentPage ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(item.page)}
            aria-label={`Page ${item.page}`}
            aria-current={item.page === currentPage ? 'page' : undefined}
          >
            {item.page}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
