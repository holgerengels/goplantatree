/**
 * Category-based gradient backgrounds for tree and offering cards.
 * Used as fallback when no image is available.
 */
export const categoryGradients = {
    'Laubbaum': 'linear-gradient(135deg, #4CAF50, #81C784)',
    'Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
    'Halbstamm-Obstbaum': 'linear-gradient(135deg, #FF9800, #FFB74D)',
    'Hochstamm-Obstbaum': 'linear-gradient(135deg, #8D6E63, #BCAAA4)',
    'Nadelbaum': 'linear-gradient(135deg, #558B2F, #8BC34A)',
    'Großstrauch': 'linear-gradient(135deg, #26A69A, #80CBC4)',
    'Strauch': 'linear-gradient(135deg, #66BB6A, #A5D6A7)',
    'news': 'linear-gradient(135deg, #2E5641, #637648)',
    'pflanzung': 'linear-gradient(135deg, #A3DE74, #4CAF50)'
};

export const defaultGradient = 'linear-gradient(135deg, #2E5641, #A3DE74)';

/**
 * Returns a CSS background style for a given category string.
 */
export const getCategoryGradient = (category) => {
    return categoryGradients[category] || defaultGradient;
};
