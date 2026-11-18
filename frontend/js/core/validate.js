// Live form validation (FR-06, FR-10 and the Contact form).
// Rules are plain functions: they get the field's value and all form values,
// and return an error message or '' when the value is fine.
import { $, $$ } from './dom.js';
import { today } from './format.js';

const PHONE = /^(?:\+?254|0)[17]\d{8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const rules = {
  required: (message) => (value) => (String(value).trim() ? '' : message),
  length: (min, max, message) => (value) => {
    const n = String(value).trim().length;
    return n >= min && n <= max ? '' : message;
  },
  phone: (value) =>
    PHONE.test(String(value).replace(/[\s-]/g, '')) ? '' : 'Enter a Kenyan mobile number, e.g. 0712 345 678.',
  optionalPhone: (value) => (String(value).trim() ? rules.phone(value) : ''),
  email: (value) => (EMAIL.test(String(value).trim()) ? '' : 'Enter a valid email address.'),
  optionalEmail: (value) => (String(value).trim() ? rules.email(value) : ''),
  notPast: (value) => (!value ? 'Choose a date.' : value < today() ? 'The date cannot be in the past.' : ''),
  positive: (message) => (value) => (Number(value) > 0 ? '' : message),
  checked: (message) => (value) => (value === true ? '' : message),
};

/** Read every named control of a form into a plain object. */
export function formValues(form) {
  const values = {};
  for (const control of form.elements) {
    if (!control.name) continue;
    if (control.type === 'checkbox' && control.dataset.group) {
      values[control.name] ??= [];
      if (control.checked) values[control.name].push(control.value);
    } else if (control.type === 'checkbox') {
      values[control.name] = control.checked;
    } else if (control.type === 'number') {
      values[control.name] = control.value === '' ? '' : Number(control.value);
    } else {
      values[control.name] = control.value;
    }
  }
  return values;
}

/** Show (or clear) the error message under one field. */
export function showError(form, name, message) {
  const holder = $(`[data-error-for="${name}"]`, form);
  const controls = $$(`[name="${name}"]`, form);
  if (holder) holder.textContent = message || '';
  for (const control of controls) {
    control.setAttribute('aria-invalid', message ? 'true' : 'false');
  }
  const field = holder?.closest('.field');
  if (field) field.classList.toggle('field--invalid', Boolean(message));
}

/**
 * Wire a form up for live validation.
 * schema: { fieldName: [rule, rule...] }
 * Returns { validate(), setServerErrors(fields) }.
 */
export function liveValidation(form, schema) {
  const touched = new Set();

  const check = (name) => {
    const values = formValues(form);
    const message = (schema[name] || []).map((rule) => rule(values[name], values)).find(Boolean) || '';
    showError(form, name, message);
    return !message;
  };

  // "input" fires on every keystroke, "focusout" when the user leaves a field.
  // A field only starts showing errors after the user has left it once.
  form.addEventListener('focusout', (event) => {
    const name = event.target.name;
    if (name && schema[name]) {
      touched.add(name);
      check(name);
    }
  });
  form.addEventListener('input', (event) => {
    const name = event.target.name;
    if (name && touched.has(name)) check(name);
  });
  form.addEventListener('change', (event) => {
    const name = event.target.name;
    if (name && schema[name] && (touched.has(name) || event.target.type === 'checkbox')) check(name);
  });

  return {
    check,
    validate() {
      const results = Object.keys(schema).map((name) => {
        touched.add(name);
        return check(name);
      });
      if (results.includes(false)) {
        $('[aria-invalid="true"]', form)?.focus();
        return false;
      }
      return true;
    },
    setServerErrors(fields = {}) {
      for (const [name, message] of Object.entries(fields)) {
        touched.add(name);
        showError(form, name, message);
      }
      $('[aria-invalid="true"]', form)?.focus();
    },
    reset() {
      touched.clear();
      for (const name of Object.keys(schema)) showError(form, name, '');
    },
  };
}
