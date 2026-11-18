// Server-side validation. The browser validates too (frontend/js/core/validate.js)
// but that is only for a friendly experience - the server never trusts it.
const config = require('../config');

const PHONE = /^(?:\+?254|0)([17]\d{8})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LISTING_ID = /^[A-Z]{3}-G[1-3]-[A-Z]{3}$/;

const CATEGORIES = ['Vegetables', 'Fruits', 'Cereals', 'Legumes', 'Tubers', 'Herbs'];
const STATUSES = ['available', 'limited', 'sold-out'];

const text = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

// Today's date in Nairobi as YYYY-MM-DD.
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date());
}

function normalisePhone(value) {
  const match = text(value).replace(/[\s-]/g, '').match(PHONE);
  return match ? `+254${match[1]}` : null;
}

function isRealDate(value) {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Small helper so each validator reads like a checklist.
function checker() {
  const errors = {};
  return {
    errors,
    require(field, ok, message) {
      if (!ok && !errors[field]) errors[field] = message;
    },
    result(value) {
      return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
    },
  };
}

function contactFields(body, c) {
  const name = text(body.contactName ?? body.name);
  const phone = normalisePhone(body.phone);
  const email = text(body.email).toLowerCase();
  c.require('contactName', name.length >= 3 && name.length <= 80, 'Enter your full name (3-80 characters).');
  c.require('phone', !!phone, 'Enter a Kenyan mobile number, e.g. 0712 345 678.');
  c.require('email', !email || EMAIL.test(email), 'Enter a valid email address or leave it empty.');
  c.require('consent', body.consent === true, 'We need your consent to store these contact details.');
  return { name, phone, email };
}

function requisition(body, { item, zone }) {
  const c = checker();
  const organisation = text(body.organisation);
  const { name, phone, email } = contactFields(body, c);
  const quantity = Number(body.quantity);
  const deliveryDate = text(body.deliveryDate);
  const notes = text(body.notes);

  c.require('organisation', organisation.length >= 3 && organisation.length <= 100, 'Enter the institution or business name.');
  c.require('produceId', !!item, 'Choose a listing from the catalog.');
  if (item) {
    c.require('produceId', item.status !== 'sold-out', `${item.crop} is sold out for this harvest.`);
    c.require('quantity', Number.isInteger(quantity) && quantity > 0, 'Quantity must be a whole number.');
    c.require('quantity', quantity >= item.moq, `Minimum order is ${item.moq} ${item.unit}s.`);
    c.require('quantity', quantity <= item.stock, `Only ${item.stock} ${item.unit}s are available.`);
  }
  c.require('zone', !!zone, 'Choose a delivery zone.');
  c.require('deliveryDate', isRealDate(deliveryDate), 'Choose a delivery date.');
  c.require('deliveryDate', deliveryDate >= today(), 'Delivery date cannot be in the past.');
  c.require('notes', notes.length <= 500, 'Keep notes under 500 characters.');

  return c.result({ organisation, contactName: name, phone, email, quantity, deliveryDate, notes });
}

function grower(body) {
  const c = checker();
  const { name, phone, email } = contactFields(body, c);
  const location = text(body.location);
  const farmSize = Number(body.farmSize);
  const crops = Array.isArray(body.crops) ? body.crops.map(text).filter(Boolean).slice(0, 12) : [];
  const cooperative = text(body.cooperative);

  c.require('location', location.length >= 2 && location.length <= 60, 'Tell us the ward or town your farm is in.');
  c.require('farmSize', farmSize > 0 && farmSize <= 500, 'Enter the farm size in acres (up to 500).');
  c.require('crops', crops.length > 0, 'Pick at least one crop you grow.');
  c.require('cooperative', cooperative.length <= 80, 'Keep the cooperative name under 80 characters.');

  return c.result({ contactName: name, phone, email, location, farmSize, crops, cooperative });
}

function message(body) {
  const c = checker();
  const name = text(body.name);
  const email = text(body.email).toLowerCase();
  const phone = text(body.phone) ? normalisePhone(body.phone) : '';
  const subject = text(body.subject);
  const content = typeof body.message === 'string' ? body.message.trim() : '';

  c.require('name', name.length >= 3 && name.length <= 80, 'Enter your full name (3-80 characters).');
  c.require('email', EMAIL.test(email), 'Enter a valid email address.');
  c.require('phone', phone !== null, 'Enter a Kenyan mobile number or leave it empty.');
  c.require('subject', subject.length >= 3 && subject.length <= 100, 'Add a short subject.');
  c.require('message', content.length >= 10 && content.length <= 1500, 'Write a message of 10-1500 characters.');
  c.require('consent', body.consent === true, 'We need your consent to store these contact details.');

  return c.result({ name, email, phone: phone || '', subject, message: content });
}

function listing(body) {
  const c = checker();
  const value = {
    id: text(body.id).toUpperCase(),
    crop: text(body.crop),
    variety: text(body.variety),
    category: text(body.category),
    grade: Number(body.grade),
    unit: text(body.unit),
    price: Number(body.price),
    moq: Number(body.moq),
    stock: Number(body.stock),
    location: text(body.location),
    cooperative: text(body.cooperative),
    harvestDate: text(body.harvestDate),
    status: text(body.status),
    image: text(body.image),
  };

  c.require('id', LISTING_ID.test(value.id), 'Use a code like TOM-G1-ATH (crop, grade, location).');
  c.require('crop', value.crop.length >= 2 && value.crop.length <= 40, 'Enter the crop name.');
  c.require('variety', value.variety.length <= 60, 'Keep the variety under 60 characters.');
  c.require('category', CATEGORIES.includes(value.category), 'Choose a category.');
  c.require('grade', [1, 2, 3].includes(value.grade), 'Grade must be 1, 2 or 3.');
  c.require('unit', value.unit.length >= 2 && value.unit.length <= 30, 'Enter the selling unit, e.g. 64 kg crate.');
  c.require('price', value.price > 0 && value.price <= 1000000, 'Enter the price per unit in KES.');
  c.require('moq', Number.isInteger(value.moq) && value.moq > 0, 'Minimum order must be a whole number.');
  c.require('stock', Number.isInteger(value.stock) && value.stock >= 0, 'Stock must be zero or more.');
  c.require('location', value.location.length >= 2 && value.location.length <= 40, 'Enter the farm location.');
  c.require('cooperative', value.cooperative.length <= 80, 'Keep the cooperative name under 80 characters.');
  c.require('harvestDate', isRealDate(value.harvestDate), 'Choose the harvest date.');
  c.require('status', STATUSES.includes(value.status), 'Choose a status.');
  c.require('image', !value.image || /^[\w-]+\.(webp|jpe?g|png)$/i.test(value.image),
    'Use a file name like tomatoes.webp that is in frontend/assets/images, or leave it empty.');

  return c.result(value);
}

module.exports = { requisition, grower, message, listing, today, text, CATEGORIES, STATUSES };
