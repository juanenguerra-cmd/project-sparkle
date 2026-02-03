import type { ReactNode } from 'react';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

type PageItem = number | 'ellipsis';

const getPageItems = (currentPage: number, totalPages: number): PageItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages: PageItem[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    pages.push('ellipsis');
  }

  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (end < totalPages - 1) {
    pages.push('ellipsis');
  }

  pages.push(totalPages);
  return pages;
};

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
  actions?: ReactNode;
}

const TablePagination = ({
  currentPage,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  itemLabel = 'items',
  className,
  actions,
}: TablePaginationProps) => {
  const pageItems = getPageItems(currentPage, totalPages);
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">
        Showing {rangeStart}-{rangeEnd} of {totalItems} {itemLabel}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {totalPages > 1 && (
          <Pagination className="mx-0 w-auto justify-start">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={cn(isPrevDisabled && 'pointer-events-none opacity-50')}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!isPrevDisabled) {
                      onPageChange(currentPage - 1);
                    }
                  }}
                />
              </PaginationItem>
              {pageItems.map((page, idx) => (
                <PaginationItem key={`${page}-${idx}`}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={page === currentPage}
                      onClick={(event) => {
                        event.preventDefault();
                        onPageChange(page);
                      }}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={cn(isNextDisabled && 'pointer-events-none opacity-50')}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!isNextDisabled) {
                      onPageChange(currentPage + 1);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
        {actions}
      </div>
    </div>
  );
};

export default TablePagination;
