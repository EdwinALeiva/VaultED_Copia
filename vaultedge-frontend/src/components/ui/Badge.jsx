import React from 'react';
import clsx from 'clsx';

const base = 'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide';
const variants = {
  neutral: 'bg-neutral-100 text-neutral-700',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-success-50 text-success-500',
  danger: 'bg-danger-100 text-danger-500'
};

export function Badge({ variant='neutral', className, ...rest }) {
  return <span className={clsx(base, variants[variant], className)} {...rest} />;
}
