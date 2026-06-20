export function parseCustomerPrompt(text) {
  let remaining = text.trim();

  remaining = remaining
    .replace(/^(please\s+)?(create|add|new|make)\s+(a\s+)?customer[:\s,-]*/i, '')
    .replace(/^(customer\s+name[:\s]*)?/i, '')
    .trim();

  const emailMatch = remaining.match(/[\w.+-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';
  if (email) remaining = remaining.replace(email, ' ').trim();

  const gstMatch = remaining.match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/i);
  const gstNumber = gstMatch ? gstMatch[0].toUpperCase() : '';
  if (gstNumber) remaining = remaining.replace(gstMatch[0], ' ').trim();

  const phoneMatch = remaining.match(/(?:\+91[\s-]?)?[6-9]\d{9}|\+?\d{10,15}/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, ' ').trim() : '';
  if (phone) remaining = remaining.replace(phoneMatch[0], ' ').trim();

  remaining = remaining
    .replace(/\b(email|e-mail|phone|mobile|mob|address|addr|gst|gstin|from|at|named|called)\b[:\s,]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let firstName = '';
  let lastName = '';
  let address = '';

  const fromMatch = remaining.match(/^(.+?)\s+from\s+(.+)$/i);
  if (fromMatch) {
    const nameParts = fromMatch[1].trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ');
    address = fromMatch[2].trim();
  } else {
    const commaParts = remaining.split(',').map((s) => s.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      const nameParts = commaParts[0].split(/\s+/);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ');
      address = commaParts.slice(1).join(', ');
    } else {
      const nameParts = remaining.split(/\s+/).filter(Boolean);
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ');
    }
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    address,
    gstNumber,
  };
}
