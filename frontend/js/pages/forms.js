// Partner as Grower (FR-10) and Contact pages. Both are "validate, send,
// show a reference number" forms, so they share this module.
import { mountLayout } from '../components/layout.js';
import { alertBox, busy, toast } from '../components/ui.js';
import { config } from '../config.js';
import { api } from '../core/api.js';
import { $, el, render } from '../core/dom.js';
import { whatsappLink } from '../core/format.js';
import { formValues, liveValidation, rules } from '../core/validate.js';

mountLayout();

const consent = rules.checked('Tick the box so we may store these contact details.');

const FORMS = {
  'grower-form': {
    endpoint: '/growers',
    busyLabel: 'Sending application…',
    success: (ref) => [
      el('h2', {}, 'Application received'),
      el('p', {}, 'Thank you. A cooperative field officer will call you within three working days to arrange a farm visit.'),
      el('p', { class: 'receipt__ref' }, ref),
    ],
    schema: {
      contactName: [rules.length(3, 80, 'Enter your full name.')],
      phone: [rules.phone],
      email: [rules.optionalEmail],
      location: [rules.length(2, 60, 'Tell us the ward or town your farm is in.')],
      farmSize: [(value) => (Number(value) > 0 && Number(value) <= 500 ? '' : 'Enter the farm size in acres.')],
      crops: [(value) => (value.length ? '' : 'Pick at least one crop you grow.')],
      consent: [consent],
    },
  },
  'contact-form': {
    endpoint: '/contact',
    busyLabel: 'Sending message…',
    success: (ref) => [
      el('h2', {}, 'Message sent'),
      el('p', {}, 'Thank you for writing. We reply to every message within one working day.'),
      el('p', { class: 'receipt__ref' }, ref),
    ],
    schema: {
      name: [rules.length(3, 80, 'Enter your full name.')],
      email: [rules.email],
      phone: [rules.optionalPhone],
      subject: [rules.length(3, 100, 'Add a short subject.')],
      message: [rules.length(10, 1500, 'Write a message of at least 10 characters.')],
      consent: [consent],
    },
  },
};

for (const [id, settings] of Object.entries(FORMS)) {
  const form = document.getElementById(id);
  if (!form) continue; // this page has the other form

  const validation = liveValidation(form, settings.schema);
  const formAlert = $('[data-form-alert]', form);
  const result = $('#result');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    render(formAlert);
    if (!validation.validate()) return;

    const done = busy($('button[type="submit"]', form), settings.busyLabel);
    try {
      const { ref } = await api.post(settings.endpoint, formValues(form));
      render(result, settings.success(ref));
      result.hidden = false;
      result.focus();
      form.reset();
      validation.reset();
      toast('Sent. Your reference number is shown on the page.');
    } catch (error) {
      if (error.status === 422) validation.setServerErrors(error.fields);
      render(
        formAlert,
        alertBox(
          'error',
          el('p', {}, error.message),
          error.status === 422
            ? null
            : el(
                'a',
                {
                  class: 'btn btn--whatsapp',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  href: whatsappLink(['Hello KilimoFresh, I could not submit the form on your website. Please call me back.']),
                },
                'Reach us on WhatsApp',
              ),
        ),
      );
    } finally {
      done();
    }
  });
}

// Live character counter for the contact message.
const message = $('#message');
const counter = $('#message-count');
if (message && counter) {
  const update = () => (counter.textContent = `${message.value.length} / ${message.maxLength}`);
  message.addEventListener('input', update);
  update();
}

// Contact details come from config.js so they are defined in one place.
for (const node of document.querySelectorAll('[data-config]')) {
  const value = config[node.dataset.config];
  node.textContent = value;
  if (node.dataset.config === 'email') node.href = `mailto:${value}`;
  if (node.dataset.config === 'phoneDisplay') node.href = `tel:+${config.whatsappNumber}`;
}
const wa = $('#whatsapp-chat');
if (wa) wa.href = whatsappLink(['Hello KilimoFresh, I have a question.']);
