import React from 'react';
import clsx from 'clsx';

const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-md focus-visible:outline-none focus-visible:ring focus-visible:ring-accent/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const variants = {
  solid: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
  subtle: 'bg-accent-subtle text-accent hover:bg-accent/10',
  ghost: 'text-accent hover:bg-accent-subtle',
  danger: 'bg-danger-500 text-white hover:brightness-90'
};
const sizes = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3 py-2',
  lg: 'text-sm px-4 py-2.5'
};

export function Button({ as: element = 'button', variant='solid', size='md', className, ...rest }) {
  const El = element; // ensures usage for linter
  return <El className={clsx(base, variants[variant], sizes[size], className)} {...rest} />;
}
