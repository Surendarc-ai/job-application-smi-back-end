// Length and width are always in mm. Convert mm² → sq ft for Tot Size.
// 1 sq ft = 304.8 × 304.8 mm² = 92903.04 mm²
const MM2_TO_SQFT = 1 / 92903.04;

export function calcJobTotals({ quantity, lengthMm, widthMm, pricePerSqft }) {
  const q = Number(quantity) || 0;
  const l = Number(lengthMm) || 0;
  const w = Number(widthMm) || 0;
  const price = Number(pricePerSqft) || 0;
  // Tot Size (sq ft) = length(mm) × width(mm) converted to square feet
  const totSizeSqFt = l * w * MM2_TO_SQFT;
  const totSqft = totSizeSqFt * q;
  const totalAmount = totSqft * price;
  return {
    totSizeSqFt: Math.round(totSizeSqFt * 10000) / 10000,
    totSqft: Math.round(totSqft * 10000) / 10000,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export function buildJobPayload(body) {
  const totals = calcJobTotals(body);
  return {
    date: new Date(body.date),
    customer: body.customer,
    projectName: String(body.projectName || '').trim(),
    model: body.model || '',
    pixel: body.pixel || '',
    jobNumber: body.jobNumber || '',
    billNo: body.billNo || '',
    quantity: Number(body.quantity) || 0,
    lengthMm: Number(body.lengthMm) || 0,
    widthMm: Number(body.widthMm) || 0,
    pricePerSqft: Number(body.pricePerSqft) || 0,
    ...totals,
    paymentStatus: body.paymentStatus || 'Non-Billed',
  };
}
