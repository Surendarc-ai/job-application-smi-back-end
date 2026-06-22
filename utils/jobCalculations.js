// Length and width are always in mm. Convert mm² → sq ft for Tot Size.
// 1 sq ft = 304.8 × 304.8 mm² = 92903.04 mm²
const MM2_TO_SQFT = 1 / 92903.04;

export function roundTotSizeSqFt(value) {
  const num = Number(value) || 0;
  const base = Math.round(num * 10000) / 10000;
  const decimalPart = Math.round((base % 1) * 100);
  if (decimalPart >= 90) {
    return Math.ceil(base - 1e-9);
  }
  return Math.round(base * 100) / 100;
}

export function calcJobTotals({ quantity, lengthMm, widthMm, pricePerSqft }) {
  const q = Number(quantity) || 0;
  const l = Number(lengthMm) || 0;
  const w = Number(widthMm) || 0;
  const price = Number(pricePerSqft) || 0;
  const totSizeSqFt = l * w * MM2_TO_SQFT;
  const roundedTotSizeSqFt = roundTotSizeSqFt(totSizeSqFt);
  const totSqft = roundedTotSizeSqFt * q;
  const totalAmount = totSqft * price;
  return {
    totSizeSqFt: Math.round(totSizeSqFt * 10000) / 10000,
    roundedTotSizeSqFt,
    totSqft: Math.round(totSqft * 10000) / 10000,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export function calcDcLineAmount({ lengthMm, widthMm, pricePerSqft, totSizeSqFt, roundedTotSizeSqFt }, dcQty) {
  const l = Number(lengthMm) || 0;
  const w = Number(widthMm) || 0;
  const price = Number(pricePerSqft) || 0;
  const q = Number(dcQty) || 0;
  const rawSize = totSizeSqFt ?? l * w * MM2_TO_SQFT;
  const roundedSize = roundedTotSizeSqFt ?? roundTotSizeSqFt(rawSize);
  return Math.round(roundedSize * q * price * 100) / 100;
}

export function calcDcDeliveredQty(dc) {
  if (!Array.isArray(dc)) return 0;
  return dc.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
}

export function calcRemainingDeliverQty(jobQty, dc) {
  const total = Number(jobQty) || 0;
  return Math.max(0, Math.round((total - calcDcDeliveredQty(dc)) * 10000) / 10000);
}

export function getDcQuantityError(jobQty, dc) {
  const base = Number(jobQty) || 0;
  if (!Array.isArray(dc)) return null;

  for (const item of dc) {
    const qty = Number(item?.quantity) || 0;
    if (qty > base) {
      return `Each DC qty cannot exceed job quantity (${base})`;
    }
  }

  const delivered = calcDcDeliveredQty(dc);
  if (delivered > base) {
    return `Total DC delivered qty (${delivered}) cannot exceed job quantity (${base})`;
  }

  return null;
}

export function normalizeDcItems(dc, jobFields = {}) {
  if (!Array.isArray(dc)) return [];
  return dc
    .map((item) => {
      if (typeof item === 'string') {
        const billNo = item.trim();
        return billNo ? { date: null, billNo, quantity: 0, amount: 0 } : null;
      }
      const quantity = Number(item.quantity) || 0;
      return {
        date: item.date ? new Date(item.date) : null,
        billNo: String(item.billNo || '').trim(),
        quantity,
        amount: calcDcLineAmount(jobFields, quantity),
      };
    })
    .filter((item) => item && (item.billNo || item.quantity));
}

export function buildJobPayload(body) {
  const totals = calcJobTotals(body);
  const dcItems = body.isDC ? normalizeDcItems(body.dc, body) : [];
  return {
    date: new Date(body.date),
    customer: body.customer,
    projectName: String(body.projectName || '').trim(),
    model: body.model || '',
    isDC: !!body.isDC,
    dc: dcItems,
    remainingDeliverQty: calcRemainingDeliverQty(body.quantity, dcItems),
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
