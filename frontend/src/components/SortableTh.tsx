'use client';

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ReactNode } from 'react';

export type SortDirection = 'asc' | 'desc';

type Props = {
  label: ReactNode;
  sortKey: string;
  currentKey: string | null;
  currentDir: SortDirection;
  onSortChange: (key: string) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
};

/**
 * Cabecalho de coluna clicavel para ordenar a tabela.
 * Ao clicar, alterna asc/desc se for a mesma coluna.
 * Mostra uma seta indicando a direcao atual.
 */
export default function SortableTh({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSortChange,
  align = 'left',
  className = '',
}: Props) {
  const isActive = currentKey === sortKey;
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const justifyClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  const Arrow = !isActive ? ArrowUpDown : currentDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th className={`${alignClass} p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${className}`}>
      <button
        type="button"
        onClick={() => onSortChange(sortKey)}
        className={`inline-flex items-center gap-1.5 ${justifyClass} w-full hover:text-slate-800 transition-colors ${
          isActive ? 'text-slate-800' : ''
        }`}
        title="Ordenar"
      >
        <span>{label}</span>
        <Arrow className={`h-3 w-3 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
      </button>
    </th>
  );
}
