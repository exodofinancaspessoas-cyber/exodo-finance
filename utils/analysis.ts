
import { CategoryStats } from './reporting';

export interface Suggestion {
    id: string;
    title: string;
    description: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    potentialSavings: number;
    categoryName: string;
    actionType: 'CUT_SPENDING' | 'SET_BUDGET' | 'CHANGE_HABIT';
}

export interface Prediction {
    month: string;
    predictedAmount: number;
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    notes: string;
}

export const analyzeSavingsOpportunities = (stats: CategoryStats[], totalAverage: number): Suggestion[] => {
    const suggestions: Suggestion[] = [];

    // Strategy 1: High growth categories (Trend UP)
    const growingCategories = stats.filter(s => s.trend === 'UP');
    growingCategories.forEach(cat => {
        // Impact definition
        const percentOfBudget = (cat.average / totalAverage) * 100;
        let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (percentOfBudget > 20) impact = 'HIGH';
        else if (percentOfBudget > 10) impact = 'MEDIUM';

        // Proposed saving: Return to average or cut by 10%
        const saving = (cat.max - cat.average) > 0 ? (cat.max - cat.average) : (cat.average * 0.1);

        suggestions.push({
            id: `grow-${cat.categoryId}`,
            title: `Reduzir gastos com ${cat.categoryName}`,
            description: `Seus gastos nesta categoria cresceram muito recentemente. Tente voltar à sua média histórica (+${cat.variation.toFixed(0)}%).`,
            impact,
            potentialSavings: saving,
            categoryName: cat.categoryName,
            actionType: 'CUT_SPENDING'
        });
    });

    // Strategy 2: Categories with high variability (Discrtionary)
    const discretionaryKeywords = ['lazer', 'jogos', 'restaurante', 'delivery', 'compras', 'shopping', 'uber'];
    const discretionaryCats = stats.filter(s => discretionaryKeywords.some(k => s.categoryName.toLowerCase().includes(k)));

    discretionaryCats.forEach(cat => {
        if (cat.average > 200) {
            suggestions.push({
                id: `disc-${cat.categoryId}`,
                title: `Otimizar ${cat.categoryName}`,
                description: `Identificamos gastos discricionários relevantes. Reduzir 20% aqui geraria uma boa economia sem afetar necessidades básicas.`,
                impact: 'MEDIUM',
                potentialSavings: cat.average * 0.2,
                categoryName: cat.categoryName,
                actionType: 'CHANGE_HABIT'
            });
        }
    });

    // Strategy 3: Top spenders check
    stats.forEach(cat => {
        if (cat.average > (totalAverage * 0.3) && !['moradia', 'aluguel'].includes(cat.categoryName.toLowerCase())) {
            suggestions.push({
                id: `heavy-${cat.categoryId}`,
                title: `Atenção aos gastos com ${cat.categoryName}`,
                description: `Esta categoria consome ${((cat.average / totalAverage) * 100).toFixed(0)}% do seu orçamento. Verifique se há planos mais baratos ou alternativas.`,
                impact: 'HIGH',
                potentialSavings: cat.average * 0.1,
                categoryName: cat.categoryName,
                actionType: 'SET_BUDGET'
            });
        }
    });

    return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings).slice(0, 5);
};

export const predictFutureSpending = (stats: CategoryStats[], historicalAverage: number): Prediction[] => {
    // Simple linear projection based on recent trend + seasonality (simplified)
    const predictions: Prediction[] = [];
    const today = new Date();

    // Look at next 3 months
    for (let i = 1; i <= 3; i++) {
        const futureDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthName = futureDate.toLocaleString('pt-BR', { month: 'long' });

        let predictedTotal = 0;
        const riskyCats: string[] = [];

        stats.forEach(cat => {
            // If up trend, assume continued slight growth
            if (cat.trend === 'UP') {
                predictedTotal += cat.average * 1.05;
                if (cat.variation > 20) riskyCats.push(cat.categoryName);
            } else {
                predictedTotal += cat.average;
            }
        });

        // Add seasonality factor if December/January
        if (futureDate.getMonth() === 11) { // Dec
            predictedTotal *= 1.25; // +25%
            riskyCats.push('Festas de Fim de Ano');
        } else if (futureDate.getMonth() === 0) { // Jan
            predictedTotal *= 1.15; // +15%
            riskyCats.push('IPVA/IPTU/Viagens');
        }

        let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (predictedTotal > historicalAverage * 1.2) riskLevel = 'HIGH';
        else if (predictedTotal > historicalAverage * 1.1) riskLevel = 'MEDIUM';

        const change = ((predictedTotal - historicalAverage) / historicalAverage) * 100;

        predictions.push({
            month: monthName,
            predictedAmount: predictedTotal,
            riskLevel,
            notes: riskLevel === 'HIGH'
                ? `Previsto aumento de ${change.toFixed(0)}%. Atenção com: ${riskyCats.slice(0, 2).join(', ')}.`
                : 'Gastos dentro da normalidade.'
        });
    }

    return predictions;
};
