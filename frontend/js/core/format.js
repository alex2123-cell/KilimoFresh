// Formatting, the cost estimate, and the WhatsApp order link.
import { config } from '../config.js';

const money = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });
export const kes = (amount) => `KES ${money.format(amount)}`;

export function shortDate(isoDate) {
  return new Intl.DateTimeFormat('en-KE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })
    .format(new Date(isoDate.length === 10 ? `${isoDate}T12:00:00+03:00` : isoDate));
}

export function dateTime(iso) {
  return new Intl.DateTimeFormat('en-KE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Nairobi' })
    .format(new Date(iso));
}

/** Today's date in Nairobi as YYYY-MM-DD (for <input type="date" min=...>). */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());
}

export const statusLabel = { available: 'Available', limited: 'Limited stock', 'sold-out': 'Sold out' };

/**
 * Process 3.0 in the browser, so the figure updates as the buyer types.
 * The server repeats the same sum when the requisition is submitted.
 */
export function estimate(item, zone, quantity) {
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  const subtotal = qty * item.price;
  const deliveryFee = zone ? zone.fee : 0;
  const warnings = [];
  if (qty < item.moq) warnings.push(`Minimum order is ${item.moq} × ${item.unit}.`);
  if (qty > item.stock) warnings.push(`Only ${item.stock} × ${item.unit} available.`);
  return { quantity: qty, subtotal, deliveryFee, total: subtotal + deliveryFee, warnings };
}

/** FR-08: a wa.me link that opens WhatsApp with the order already typed. */
export function whatsappLink(lines) {
  return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(lines.filter(Boolean).join('\n'))}`;
}

export function whatsappOrderLink({ item, quantity, zone, deliveryDate, organisation, ref, total }) {
  return whatsappLink([
    'Hello KilimoFresh, I would like to place a bulk order.',
    ref && `Reference: ${ref}`,
    organisation && `Institution: ${organisation}`,
    item && `Produce: ${item.crop} (Grade ${item.grade}) - ${item.id}`,
    quantity && item && `Quantity: ${quantity} x ${item.unit}`,
    zone && `Deliver to: ${zone.name}`,
    deliveryDate && `Delivery date: ${deliveryDate}`,
    total && `Estimated total: ${kes(total)}`,
  ]);
}
