import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * CustomSelect
 * - Reusable select component that normalizes values to string
 * - Accepts options as [{ code, name }]
 * - Shows label, error state, and supports addDefaultOption
 * - Accessible: links label to select, includes aria-invalid
 */
export default function CustomSelect({
  label,
  name,
  value,
  onChange,
  options,
  error,
  addDefaultOption = 'N',
  disabled = false,
  id,
  className = '',
  optionValueKey = 'code',
  optionLabelKey = 'name',
  required = false,
  ...rest
}) {
  const selectId = id || `select_${name}`;

  // normalize incoming value to string (null/undefined -> '')
  const normalizedValue = useMemo(() => {
    if (value === null || value === undefined) return '';
    return String(value);
  }, [value]);

  const safeOptions = useMemo(() => {
    if (!Array.isArray(options)) return [];
    return options.map((o) => {
      if (!o) return null;
      const v = o[optionValueKey];
  const l = o[optionLabelKey] ?? String(v ?? '');
  const badge = o.badge || '';
  // For the special 'parent' badge we prefer not to append the badge text.
  // For 'parent' badge prepend a star; avoid inline styling so only the star is visible cue
  const display = badge === 'parent' ? `★ ${l}` : (badge ? `${l} — ${badge}` : String(l));
  return { value: v === null || v === undefined ? '' : String(v), label: String(display), badge };
    }).filter(Boolean);
  }, [options, optionValueKey, optionLabelKey]);

  // keep simple: we don't need an overlay for selected value

  const handleChange = (e) => {
    // always pass normalized string to consumer
    const raw = e?.target?.value;
    onChange && onChange(String(raw));
  };

  // Note: native <option> elements have limited styling; we prepend a star for 'parent' entries
  return (
    <div className={`ve-select ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      )}
      <div>
        <select
          id={selectId}
          name={name}
          value={normalizedValue}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={!!error}
          className={`mt-1 block w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-300 ${error ? 'border-red-500' : 'border-gray-300'}`}
          {...rest}
        >
          {String(addDefaultOption).toUpperCase() === 'Y' && (
            <option value="">select... </option>
          )}
          {safeOptions.length === 0 ? (
              <option value="">(no options)</option>
            ) : safeOptions.map((o) => (
              <option key={o.value + '::' + o.label} value={o.value}>{o.label}</option>
            ))}
        </select>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

CustomSelect.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.any,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.array,
  error: PropTypes.string,
  addDefaultOption: PropTypes.oneOf(['Y', 'N', 'y', 'n']),
  disabled: PropTypes.bool,
  id: PropTypes.string,
  className: PropTypes.string,
  optionValueKey: PropTypes.string,
  optionLabelKey: PropTypes.string,
  required: PropTypes.bool,
};
