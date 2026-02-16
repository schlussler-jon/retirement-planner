"""
Investment account operations.

Handles monthly contributions, withdrawals, and growth calculations.
Operations are applied in a specific order each month (documented below).
"""

from typing import Dict
from models import InvestmentAccount, TaxBucket
from .timeline import month_is_before, month_is_after


class AccountState:
    """
    Tracks the current state of an investment account.
    
    The balance changes each month due to:
    1. Contributions (increase balance)
    2. Withdrawals (decrease balance)
    3. Growth (compounded monthly)
    """
    
    def __init__(self, account: InvestmentAccount):
        """
        Initialize account state.
        
        Args:
            account: The account configuration
        """
        self.account = account
        self.balance = account.starting_balance
    
    def should_contribute(self, year_month: str) -> bool:
        """
        Check if contributions should happen this month.
        
        Args:
            year_month: Current month in YYYY-MM format
            
        Returns:
            True if contributions should be applied this month
        """
        # Check start date
        if self.account.contribution_start_month:
            if month_is_before(year_month, self.account.contribution_start_month):
                return False
        
        # Check end date
        if self.account.contribution_end_month:
            if month_is_after(year_month, self.account.contribution_end_month):
                return False
        
        return True
    
    def should_withdraw(self, year_month: str) -> bool:
        """
        Check if withdrawals should happen this month.
        
        Args:
            year_month: Current month in YYYY-MM format
            
        Returns:
            True if withdrawals should be applied this month
        """
        # Check start date
        if self.account.withdrawal_start_month:
            if month_is_before(year_month, self.account.withdrawal_start_month):
                return False
        
        # Check end date
        if self.account.withdrawal_end_month:
            if month_is_after(year_month, self.account.withdrawal_end_month):
                return False
        
        return True
    
    def apply_contribution(self, year_month: str) -> None:
        """
        Apply monthly contribution if within date range.
        
        Increases the account balance by the fixed monthly contribution amount.
        
        Args:
            year_month: Current month in YYYY-MM format
        """
        if self.should_contribute(year_month):
            self.balance += self.account.monthly_contribution
    
    def apply_withdrawal(self, year_month: str) -> float:
        """
        Apply monthly withdrawal if within date range.
        
        CRITICAL: Withdrawals are POSITIVE numbers that REDUCE the balance.
        All withdrawals are considered INCOME/CASHFLOW to the user.
        
        Args:
            year_month: Current month in YYYY-MM format
            
        Returns:
            The withdrawal amount (this becomes income)
        """
        if not self.should_withdraw(year_month):
            return 0.0
        
        withdrawal = self.account.monthly_withdrawal
        
        # Reduce balance (withdrawal is a positive number)
        self.balance -= withdrawal
        
        # Prevent negative balances (account depleted)
        if self.balance < 0:
            # Adjust withdrawal to what was actually available
            actual_withdrawal = withdrawal + self.balance
            self.balance = 0.0
            return actual_withdrawal
        
        return withdrawal
    
    def apply_growth(self) -> None:
        """
        Apply monthly growth using compounded returns.
        
        Formula: balance *= (1 + monthly_rate)
        where monthly_rate = (1 + annual_rate)^(1/12) - 1
        
        The monthly_return_rate is pre-computed in the InvestmentAccount model.
        """
        self.balance *= (1 + self.account.monthly_return_rate)
    
    def get_balance(self) -> float:
        """
        Get current account balance.
        
        Returns:
            Current balance
        """
        return self.balance


class AccountProcessor:
    """
    Processes all investment accounts for a projection.
    
    Applies operations in the correct order:
    1. Contributions
    2. Withdrawals
    3. Surplus deposit (if designated account exists)
    4. Growth
    """
    
    def __init__(self, accounts: list[InvestmentAccount]):
        """
        Initialize processor with accounts.
        
        Args:
            accounts: List of investment account configurations
        """
        self.accounts = accounts
        self.states: Dict[str, AccountState] = {
            account.account_id: AccountState(account)
            for account in accounts
        }
    
    def deposit_surplus(self, surplus_amount: float) -> None:
        """
        Deposit surplus into the designated account.
        
        This happens BEFORE growth is applied, so the surplus earns returns
        starting this month.
        
        Args:
            surplus_amount: Amount to deposit (can be negative for deficit)
        """
        # Find the account that receives surplus
        surplus_account_id = None
        for account in self.accounts:
            if account.receives_surplus:
                surplus_account_id = account.account_id
                break
        
        if not surplus_account_id:
            # No account designated - surplus not deposited
            return
        
        # Add surplus to the account balance (before growth is applied)
        state = self.states[surplus_account_id]
        state.balance += surplus_amount
        
        # Prevent negative balances
        if state.balance < 0:
            state.balance = 0.0
    
    def process_month(self, year_month: str, prior_month_surplus: float = 0.0) -> tuple[Dict[str, float], Dict[str, float]]:
        """
        Process all accounts for a single month.
        
        CRITICAL ORDER (must be followed exactly):
        1. Apply contributions to all accounts (if within date range)
        2. Apply withdrawals to all accounts (if within date range - these become income)
        3. Apply prior month's surplus to designated account
        4. Apply growth to all accounts
        
        Args:
            year_month: Current month in YYYY-MM format
            prior_month_surplus: Surplus from previous month to deposit before growth
        
        Returns:
            Tuple of:
            - withdrawals_by_account: Dict mapping account_id to withdrawal amount
            - balances_by_account: Dict mapping account_id to end-of-month balance
        """
        withdrawals: Dict[str, float] = {}
        balances: Dict[str, float] = {}
        
        # Step 1: Contributions (check date range)
        for account in self.accounts:
            state = self.states[account.account_id]
            state.apply_contribution(year_month)
        
        # Step 2: Withdrawals (check date range - these become income!)
        for account in self.accounts:
            state = self.states[account.account_id]
            withdrawal = state.apply_withdrawal(year_month)
            withdrawals[account.account_id] = withdrawal
        
        # Step 3: Deposit prior month's surplus (before growth!)
        if prior_month_surplus != 0.0:
            self.deposit_surplus(prior_month_surplus)
        
        # Step 4: Growth
        for account in self.accounts:
            state = self.states[account.account_id]
            state.apply_growth()
            balances[account.account_id] = state.get_balance()
        
        return withdrawals, balances
    
    def get_total_balance(self) -> float:
        """
        Get total balance across all accounts.
        
        Returns:
            Sum of all account balances
        """
        return sum(state.get_balance() for state in self.states.values())
    
    def get_balances_by_tax_bucket(self) -> Dict[str, float]:
        """
        Group account balances by tax bucket.
        
        Returns:
            Dictionary mapping tax bucket to total balance
        """
        by_bucket: Dict[str, float] = {}
        
        for account in self.accounts:
            bucket = account.tax_bucket.value
            balance = self.states[account.account_id].get_balance()
            
            if bucket in by_bucket:
                by_bucket[bucket] += balance
            else:
                by_bucket[bucket] = balance
        
        return by_bucket
    
    def get_withdrawals_by_tax_bucket(
        self, 
        withdrawals_by_account: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Group withdrawals by tax bucket.
        
        This is needed for tax calculations.
        
        Args:
            withdrawals_by_account: Dictionary of withdrawals by account
            
        Returns:
            Dictionary mapping tax bucket to total withdrawals
        """
        by_bucket: Dict[str, float] = {}
        
        for account in self.accounts:
            bucket = account.tax_bucket.value
            withdrawal = withdrawals_by_account.get(account.account_id, 0.0)
            
            if bucket in by_bucket:
                by_bucket[bucket] += withdrawal
            else:
                by_bucket[bucket] = withdrawal
        
        return by_bucket
    
    def get_taxable_withdrawals(
        self, 
        withdrawals_by_account: Dict[str, float]
    ) -> float:
        """
        Get total withdrawals from taxable accounts (tax-deferred + taxable).
        
        In v1, both tax-deferred and taxable account withdrawals are treated
        as ordinary income. Roth withdrawals are tax-free.
        
        Args:
            withdrawals_by_account: Dictionary of withdrawals by account
            
        Returns:
            Total taxable withdrawals
        """
        total = 0.0
        
        for account in self.accounts:
            # Roth withdrawals are not taxable
            if account.tax_bucket == TaxBucket.ROTH:
                continue
            
            withdrawal = withdrawals_by_account.get(account.account_id, 0.0)
            total += withdrawal
        
        return total
    
    def get_account_balance(self, account_id: str) -> float:
        """
        Get balance for a specific account.
        
        Args:
            account_id: Account identifier
            
        Returns:
            Current balance for that account
        """
        state = self.states.get(account_id)
        if state is None:
            return 0.0
        return state.get_balance()