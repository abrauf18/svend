export const getCurrencySymbol = (currencyCode: string): string => {
  try {
    return (
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'symbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value || '$'
    );
  } catch (e) {
    return '$'; // Fallback if invalid currency code
  }
};
