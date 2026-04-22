'use client';

import { useMemo, useState } from 'react';
import type { SortDirection } from '@/components/SortableTh';

type Getter<T> = (item: T) => string | number | null | undefined;

export type SortConfig<T> = {
  /** Chave unica que representa a coluna. */
  key: string;
  /** Funcao que retorna o valor a ser comparado. */
  getter: Getter<T>;
  /** Direcao default quando a coluna e selecionada pela primeira vez. */
  defaultDir?: SortDirection;
};

type Options<T> = {
  columns: Record<string, SortConfig<T>>;
  defaultKey?: string | null;
  defaultDir?: SortDirection;
};

/**
 * Hook para ordenacao de tabelas com cabecalho clicavel.
 *
 * Uso:
 *   const { sortKey, sortDir, handleSort, sortedData } = useTableSort(items, {
 *     columns: {
 *       name: { key: 'name', getter: (x) => x.name },
 *       usage: { key: 'usage', getter: (x) => x.current_usage, defaultDir: 'desc' },
 *     },
 *     defaultKey: 'name',
 *     defaultDir: 'asc',
 *   });
 */
export function useTableSort<T>(data: T[], options: Options<T>) {
  const { columns, defaultKey = null, defaultDir = 'asc' } = options;

  const [sortKey, setSortKey] = useState<string | null>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultDir);

  function handleSort(key: string) {
    if (key === sortKey) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(columns[key]?.defaultDir || 'asc');
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !columns[sortKey]) return data;
    const getter = columns[sortKey].getter;
    const copy = [...data];
    const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
    copy.sort((a, b) => {
      const va = getter(a);
      const vb = getter(b);
      // null / undefined sempre no final
      const aNull = va == null || va === '';
      const bNull = vb == null || vb === '';
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = collator.compare(String(va), String(vb));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir, columns]);

  return { sortKey, sortDir, handleSort, sortedData };
}
