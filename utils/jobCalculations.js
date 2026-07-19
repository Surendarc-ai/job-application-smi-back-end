// Length and width are always in mm. Convert mm² → sq ft for Tot Size.
// 1 sq ft = 304.8 × 304.8 mm² = 92903.04 mm²
const MM2_TO_SQFT = 1 / 92903.04;

// Round up when decimal part is .8 or higher (e.g. 11.80, 11.90 → 12). Below .8 keep as is.
export function roundTotSizeSqFt(value) {
  const num = Number(value) || 0;
  const base = Math.round(num * 10000) / 10000;
  const fractional = base - Math.floor(base);
  if (fractional >= 0.8) {
    return Math.ceil(base - 1e-9);
  }
  return Math.round(base * 100) / 100;
}

// Round up when decimal part is .8 or higher (e.g. 11.8, 11.9 → 12). Below .8 keep as is.
export function roundTotalAmount(value) {
  const num = Number(value) || 0;
  const base = Math.round(num * 10000) / 10000;
  const fractional = base - Math.floor(base);
  if (fractional >= 0.8) {
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
  const totalAmount = roundTotalAmount(totSqft * price);
  return {
    totSizeSqFt: Math.round(totSizeSqFt * 10000) / 10000,
    roundedTotSizeSqFt,
    totSqft: Math.round(totSqft * 10000) / 10000,
    totalAmount,
  };
}

export function calcDcLineAmount({ lengthMm, widthMm, pricePerSqft, totSizeSqFt, roundedTotSizeSqFt }, dcQty) {
  const l = Number(lengthMm) || 0;
  const w = Number(widthMm) || 0;
  const price = Number(pricePerSqft) || 0;
  const q = Number(dcQty) || 0;
  const rawSize = totSizeSqFt ?? l * w * MM2_TO_SQFT;
  const roundedSize = roundedTotSizeSqFt ?? roundTotSizeSqFt(rawSize);
  return roundTotalAmount(roundedSize * q * price);
}

export function calcDcDeliveredQty(dc) {
  if (!Array.isArray(dc)) return 0;
  return dc.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);
}

export function calcRemainingDeliverQty(jobQty, dc) {
  const total = Number(jobQty) || 0;
  return Math.round((total - calcDcDeliveredQty(dc)) * 10000) / 10000;
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
      const calculated = calcDcLineAmount(jobFields, quantity);
      const amount = item.amount !== undefined && item.amount !== null && item.amount !== ''
        ? roundTotalAmount(item.amount)
        : calculated;
      return {
        date: item.date ? new Date(item.date) : null,
        billNo: String(item.billNo || '').trim(),
        quantity,
        amount,
      };
    })
    .filter((item) => item && (item.billNo || item.quantity));
}

export function buildJobPayload(body) {
  const totals = calcJobTotals(body);
  const dcItems = body.isDC ? normalizeDcItems(body.dc, body) : [];
  const totalAmount = body.totalAmount !== undefined && body.totalAmount !== null && body.totalAmount !== ''
    ? roundTotalAmount(body.totalAmount)
    : totals.totalAmount;
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
    totalAmount,
    paymentStatus: body.paymentStatus || 'Non-Billed',
  };
}
