// Links that open the customer's contacts in the phone's apps (call,
// WhatsApp, email). Pure: the screen opens them through Dependencies.openUrl.

export interface ContactLinks {
  call?: string;
  whatsapp?: string;
  email?: string;
}

/**
 * The core stores phone numbers in E.164 (`+393331234567`). A number in
 * another form can still be called as it is; WhatsApp needs the
 * international form, so it is offered only for E.164 numbers.
 */
export function contactLinks(contacts: { phone?: string; email?: string }): ContactLinks {
  const links: ContactLinks = {};
  const phone = contacts.phone?.replace(/[\s().-]/g, '') ?? '';
  if (/^\+?[0-9]{3,15}$/.test(phone)) {
    links.call = `tel:${phone}`;
    if (/^\+[1-9][0-9]{6,14}$/.test(phone)) links.whatsapp = `https://wa.me/${phone.slice(1)}`;
  }
  const email = contacts.email?.trim() ?? '';
  if (/^[^\s@]+@[^\s@]+$/.test(email)) links.email = `mailto:${email}`;
  return links;
}
