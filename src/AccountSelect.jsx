import React, { useState, useRef, useEffect } from 'react';
import { getAccountBrand } from './accountConfig.js';

export function AccountBadge({ name, size = 'md' }) {
  const { color, initials } = getAccountBrand(name);
  const cls = size === 'sm'
    ? 'w-5 h-5 text-[8px]'
    : 'w-6 h-6 text-[10px]';
  return (
    <span
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

function fmtBal(a) {
  if (a.currentBalance === undefined || a.currentBalance === null) return '';
  return `${a.currency || ''} ${Number(a.currentBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}`.trim();
}

export default function AccountSelect({ value, onChange, accounts, placeholder = '— Select —', className = '', compact = false, showBalance = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = accounts.find(a => a.id === value);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(id) { onChange(id); setOpen(false); }

  const triggerCls = compact
    ? 'px-2.5 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-gray-300 flex items-center gap-1.5 hover:border-neutral-600 transition cursor-pointer'
    : 'w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm flex items-center gap-2.5 text-left hover:border-neutral-600 transition';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} className={triggerCls}>
        {selected ? (
          <>
            <AccountBadge name={selected.name} size={compact ? 'sm' : 'md'} />
            <span className={compact ? 'text-gray-300' : 'flex-1 truncate text-white'}>{selected.name}</span>
            {showBalance && <span className="text-gray-500 text-[10px] font-mono ml-auto shrink-0">{fmtBal(selected)}</span>}
          </>
        ) : (
          <span className={compact ? 'text-gray-400' : 'flex-1 text-gray-500'}>{placeholder}</span>
        )}
        <span className="text-gray-500 text-[10px] ml-0.5">▾</span>
      </button>

      {open && (
        <div className="absolute z-[60] mt-1 w-max min-w-full bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
          {placeholder && (
            <button type="button" onClick={() => select('')}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-neutral-700 transition whitespace-nowrap">
              {placeholder}
            </button>
          )}
          {accounts.map(a => (
            <button key={a.id} type="button" onClick={() => select(a.id)}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2.5 hover:bg-neutral-700 transition whitespace-nowrap ${a.id === value ? 'bg-neutral-700/60' : ''}`}>
              <AccountBadge name={a.name} size="sm" />
              <span className="text-white">{a.name}</span>
              {showBalance && <span className="text-gray-500 text-[10px] font-mono ml-auto shrink-0 pl-3">{fmtBal(a)}</span>}
              {a.id === value && <span className={`${showBalance ? '' : 'ml-auto'} pl-2 text-emerald-400 text-xs shrink-0`}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
