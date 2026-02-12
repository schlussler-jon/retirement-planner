/**
 * Parse Pydantic validation errors into user-friendly messages
 */

interface ValidationErrorDetail {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * Parse backend validation error into user-friendly message
 */
export function parseValidationError(errorDetail: string | ValidationErrorDetail[]): string {
  // If it's already a string, try to extract useful info
  if (typeof errorDetail === 'string') {
    return parseStringError(errorDetail);
  }

  // If it's an array of validation errors (Pydantic format)
  if (Array.isArray(errorDetail) && errorDetail.length > 0) {
    const errors = errorDetail.map(err => formatValidationError(err));
    return errors.join('\n');
  }

  return 'Invalid scenario data. Please check all fields.';
}

/**
 * Parse string error messages from backend
 */
function parseStringError(error: string): string {
  // Match Pydantic error format
  const lines = error.split('\n');
  
  if (lines.length < 2) {
    return error;
  }

  // Extract field path (line 2)
  const fieldPath = lines[1]?.trim();
  if (!fieldPath) {
    return error;
  }

  // Extract error message (line 3)
  const errorMsg = lines[2]?.trim() || 'Invalid value';

  return formatFieldError(fieldPath, errorMsg);
}

/**
 * Format a single validation error
 */
function formatValidationError(err: ValidationErrorDetail): string {
  const fieldPath = err.loc.join('.');
  return formatFieldError(fieldPath, err.msg);
}

/**
 * Format field path and message into user-friendly error
 */
function formatFieldError(fieldPath: string, message: string): string {
  const parts = fieldPath.split('.');
  
  // Parse field path
  let category = '';
  let index = -1;
  let field = '';

  if (parts.length >= 1) {
    category = parts[0];
  }
  if (parts.length >= 2 && !isNaN(Number(parts[1]))) {
    index = Number(parts[1]);
  }
  if (parts.length >= 3) {
    field = parts[parts.length - 1];
  } else if (parts.length === 2 && isNaN(Number(parts[1]))) {
    field = parts[1];
  }

  // Format based on category
  const friendlyCategory = getFriendlyCategory(category);
  const friendlyField = getFriendlyField(field);
  const itemNumber = index >= 0 ? ` #${index + 1}` : '';

  // Clean up message
  const cleanMsg = cleanMessage(message, field);

  return `${friendlyCategory}${itemNumber}: ${friendlyField} ${cleanMsg}`;
}

/**
 * Get friendly category name
 */
function getFriendlyCategory(category: string): string {
  const mapping: Record<string, string> = {
    'income_streams': 'Income Stream',
    'investment_accounts': 'Investment Account',
    'people': 'Person',
    'budget_settings': 'Budget',
    'categories': 'Budget Category',
    'tax_settings': 'Tax Settings',
    'global_settings': 'Settings',
  };
  return mapping[category] || category;
}

/**
 * Get friendly field name
 */
function getFriendlyField(field: string): string {
  const mapping: Record<string, string> = {
    'monthly_amount_at_start': 'monthly amount',
    'starting_balance': 'starting balance',
    'annual_return_rate': 'annual return rate',
    'monthly_contribution': 'monthly contribution',
    'monthly_withdrawal': 'monthly withdrawal',
    'birth_date': 'birth date',
    'life_expectancy_years': 'life expectancy',
    'start_month': 'start date',
    'end_month': 'end date',
    'contribution_start_month': 'contribution start date',
    'contribution_end_month': 'contribution end date',
    'withdrawal_start_month': 'withdrawal start date',
    'withdrawal_end_month': 'withdrawal end date',
    'cola_percent_annual': 'COLA percentage',
    'category_name': 'category name',
    'monthly_amount': 'monthly amount',
    'filing_status': 'filing status',
  };
  return mapping[field] || field.replace(/_/g, ' ');
}

/**
 * Clean up error message
 */
function cleanMessage(message: string, field: string): string {
  // Remove redundant field name from message
  let cleaned = message.replace(new RegExp(field.replace(/_/g, ' '), 'gi'), '');
  
  // Simplify common Pydantic messages
  cleaned = cleaned
    .replace(/Input should be greater than 0/i, 'must be greater than $0')
    .replace(/Input should be greater than or equal to 0/i, 'must be $0 or more')
    .replace(/String should have at least \d+ characters?/i, 'is required')
    .replace(/Field required/i, 'is required')
    .replace(/value is not a valid/i, 'is invalid')
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  }

  return cleaned || 'is invalid';
}
