
// Financial Calculation Utilities

/**
 * Calculates the monthly payment for a loan/installment plan using Price Table (Compound Interest)
 * PMT = Pv * i / (1 - (1+i)^-n)
 * @param principal The total amount to be paid (Present Value)
 * @param monthlyRate The monthly interest rate in percentage (e.g., 2.5 for 2.5%)
 * @param months Number of installments
 */
export const calculatePMT = (principal: number, monthlyRate: number, months: number): number => {
    if (monthlyRate === 0) return principal / months;

    const i = monthlyRate / 100;
    const pmt = principal * (i * Math.pow(1 + i, months)) / (Math.pow(1 + i, months) - 1);
    return Number(pmt.toFixed(2));
};

/**
 * Calculates the Total Effective Cost (rough estimation based on total paid vs principal)
 * @param principal Original amount
 * @param totalPaid Total amount paid after installments
 */
export const calculateCET = (principal: number, totalPaid: number): number => {
    if (principal === 0) return 0;
    return ((totalPaid - principal) / principal) * 100;
};

/**
 * Calculates impact percentage on a budget
 * @param installmentValue Monthly payment value
 * @param monthlyIncome Total monthly income
 */
export const calculateBudgetImpact = (installmentValue: number, monthlyIncome: number): number => {
    if (monthlyIncome === 0) return 100;
    return (installmentValue / monthlyIncome) * 100;
};
