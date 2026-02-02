"""
Unit tests for account operations.

Tests contributions, withdrawals, and growth calculations.
Critical: Withdrawals are POSITIVE numbers that REDUCE balance.
"""

import pytest
from models import InvestmentAccount, TaxBucket
from engine.accounts import AccountProcessor, AccountState


class TestAccountState:
    """Tests for AccountState class."""
    
    def test_initial_state(self):
        """Test initial account state."""
        account = InvestmentAccount(
            account_id="test",
            name="Test Account",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=100000.0,
            annual_return_rate=0.06
        )
        
        state = AccountState(account)
        assert state.balance == 100000.0
    
    def test_contribution(self):
        """Test applying contribution."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.ROTH,
            starting_balance=50000.0,
            annual_return_rate=0.06,
            monthly_contribution=500.0
        )
        
        state = AccountState(account)
        state.apply_contribution()
        
        assert state.balance == 50500.0  # 50000 + 500
    
    def test_withdrawal(self):
        """Test applying withdrawal (POSITIVE number REDUCES balance)."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=100000.0,
            annual_return_rate=0.06,
            monthly_withdrawal=2000.0
        )
        
        state = AccountState(account)
        withdrawal = state.apply_withdrawal()
        
        assert withdrawal == 2000.0  # This is income to the user
        assert state.balance == 98000.0  # 100000 - 2000
    
    def test_withdrawal_exceeds_balance(self):
        """Test withdrawal when balance is insufficient."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.TAXABLE,
            starting_balance=1000.0,
            annual_return_rate=0.06,
            monthly_withdrawal=1500.0  # More than balance!
        )
        
        state = AccountState(account)
        withdrawal = state.apply_withdrawal()
        
        # Should only withdraw what's available
        assert withdrawal == 1000.0
        assert state.balance == 0.0  # Depleted
    
    def test_growth(self):
        """Test applying monthly growth."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.TAXABLE,
            starting_balance=100000.0,
            annual_return_rate=0.06  # 6% annual
        )
        
        state = AccountState(account)
        state.apply_growth()
        
        # Monthly rate: (1.06)^(1/12) - 1 ≈ 0.004868
        # New balance: 100000 * 1.004868 ≈ 100486.8
        expected = 100000.0 * (1.06 ** (1/12))
        assert abs(state.balance - expected) < 1.0
    
    def test_operation_order(self):
        """Test correct order: contribution, withdrawal, growth."""
        account = InvestmentAccount(
            account_id="test",
            name="Test",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=100000.0,
            annual_return_rate=0.06,
            monthly_contribution=1000.0,
            monthly_withdrawal=500.0
        )
        
        state = AccountState(account)
        
        # Step 1: Contribution
        state.apply_contribution()
        assert state.balance == 101000.0  # 100000 + 1000
        
        # Step 2: Withdrawal
        withdrawal = state.apply_withdrawal()
        assert withdrawal == 500.0
        assert state.balance == 100500.0  # 101000 - 500
        
        # Step 3: Growth
        state.apply_growth()
        expected = 100500.0 * (1.06 ** (1/12))
        assert abs(state.balance - expected) < 1.0


class TestAccountProcessor:
    """Tests for AccountProcessor class."""
    
    def test_single_account_month(self):
        """Test processing a single account for one month."""
        account = InvestmentAccount(
            account_id="401k",
            name="401k",
            tax_bucket=TaxBucket.TAX_DEFERRED,
            starting_balance=100000.0,
            annual_return_rate=0.06,
            monthly_contribution=500.0,
            monthly_withdrawal=1000.0
        )
        
        processor = AccountProcessor([account])
        withdrawals, balances = processor.process_month()
        
        # Check withdrawal
        assert withdrawals["401k"] == 1000.0
        
        # Check final balance
        # Start: 100000
        # +contribution: 100500
        # -withdrawal: 99500
        # *growth: 99500 * (1.06^(1/12))
        expected_balance = 99500.0 * (1.06 ** (1/12))
        assert abs(balances["401k"] - expected_balance) < 1.0
    
    def test_multiple_accounts(self):
        """Test processing multiple accounts."""
        accounts = [
            InvestmentAccount(
                account_id="401k",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=50000.0,
                annual_return_rate=0.06
            ),
            InvestmentAccount(
                account_id="roth",
                name="Roth IRA",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=30000.0,
                annual_return_rate=0.07,
                monthly_withdrawal=500.0
            )
        ]
        
        processor = AccountProcessor(accounts)
        withdrawals, balances = processor.process_month()
        
        assert withdrawals["401k"] == 0.0
        assert withdrawals["roth"] == 500.0
        
        # Total balance should be sum of both accounts (after operations)
        total = processor.get_total_balance()
        assert total > 79000  # Approximate, after withdrawal and growth
    
    def test_get_balances_by_tax_bucket(self):
        """Test grouping balances by tax bucket."""
        accounts = [
            InvestmentAccount(
                account_id="401k",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate=0.06
            ),
            InvestmentAccount(
                account_id="457b",
                name="457b",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=50000.0,
                annual_return_rate=0.06
            ),
            InvestmentAccount(
                account_id="roth",
                name="Roth",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=30000.0,
                annual_return_rate=0.07
            )
        ]
        
        processor = AccountProcessor(accounts)
        processor.process_month()
        
        by_bucket = processor.get_balances_by_tax_bucket()
        
        # Tax-deferred should be ~150000 (401k + 457b with growth)
        assert by_bucket["tax_deferred"] > 149000
        assert by_bucket["tax_deferred"] < 152000
        
        # Roth should be ~30000 with growth
        assert by_bucket["roth"] > 29000
        assert by_bucket["roth"] < 32000
    
    def test_get_withdrawals_by_tax_bucket(self):
        """Test grouping withdrawals by tax bucket."""
        accounts = [
            InvestmentAccount(
                account_id="401k",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate=0.06,
                monthly_withdrawal=1000.0
            ),
            InvestmentAccount(
                account_id="457b",
                name="457b",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=50000.0,
                annual_return_rate=0.06,
                monthly_withdrawal=500.0
            ),
            InvestmentAccount(
                account_id="roth",
                name="Roth",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=30000.0,
                annual_return_rate=0.07,
                monthly_withdrawal=300.0
            )
        ]
        
        processor = AccountProcessor(accounts)
        withdrawals, _ = processor.process_month()
        
        by_bucket = processor.get_withdrawals_by_tax_bucket(withdrawals)
        
        assert by_bucket["tax_deferred"] == 1500.0  # 1000 + 500
        assert by_bucket["roth"] == 300.0
    
    def test_get_taxable_withdrawals(self):
        """Test calculating taxable withdrawals (excludes Roth)."""
        accounts = [
            InvestmentAccount(
                account_id="401k",
                name="401k",
                tax_bucket=TaxBucket.TAX_DEFERRED,
                starting_balance=100000.0,
                annual_return_rate=0.06,
                monthly_withdrawal=1000.0
            ),
            InvestmentAccount(
                account_id="brokerage",
                name="Brokerage",
                tax_bucket=TaxBucket.TAXABLE,
                starting_balance=50000.0,
                annual_return_rate=0.08,
                monthly_withdrawal=500.0
            ),
            InvestmentAccount(
                account_id="roth",
                name="Roth",
                tax_bucket=TaxBucket.ROTH,
                starting_balance=30000.0,
                annual_return_rate=0.07,
                monthly_withdrawal=300.0  # NOT taxable
            )
        ]
        
        processor = AccountProcessor(accounts)
        withdrawals, _ = processor.process_month()
        
        taxable = processor.get_taxable_withdrawals(withdrawals)
        
        # Should be 1000 + 500 = 1500 (excludes Roth 300)
        assert taxable == 1500.0
    
    def test_zero_balance_account(self):
        """Test account with zero starting balance."""
        account = InvestmentAccount(
            account_id="empty",
            name="Empty Account",
            tax_bucket=TaxBucket.TAXABLE,
            starting_balance=0.0,
            annual_return_rate=0.06,
            monthly_contribution=100.0
        )
        
        processor = AccountProcessor([account])
        _, balances = processor.process_month()
        
        # Should be 100 + growth
        expected = 100.0 * (1.06 ** (1/12))
        assert abs(balances["empty"] - expected) < 0.1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
