// Process 3.0 - Estimate Order Cost.
// quantity x unit price (from D1) + delivery fee (from D3), with a warning
// when the quantity is below the listing's minimum order.
const crypto = require('crypto');

function estimate(item, zone, quantity) {
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const subtotal = qty * item.price;
  const deliveryFee = zone ? zone.fee : 0;
  const warnings = [];

  if (qty < item.moq) warnings.push(`Minimum order is ${item.moq} ${item.unit}s.`);
  if (qty > item.stock) warnings.push(`Only ${item.stock} ${item.unit}s are available.`);
  if (item.status === 'sold-out') warnings.push('This listing is sold out.');

  return {
    produceId: item.id,
    quantity: qty,
    unitPrice: item.price,
    subtotal,
    zone: zone ? zone.id : null,
    deliveryFee,
    deliveryDays: zone ? zone.days : null,
    total: subtotal + deliveryFee,
    belowMinimum: qty < item.moq,
    warnings,
  };
}

// Reference numbers such as KF-20261116-7QK4M. The alphabet leaves out
// 0/O and 1/I so a number read over the phone is not misheard.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function reference(prefix, day) {
  let code = '';
  for (const byte of crypto.randomBytes(5)) code += ALPHABET[byte % ALPHABET.length];
  return `${prefix}-${day.replace(/-/g, '')}-${code}`;
}

module.exports = { estimate, reference };
