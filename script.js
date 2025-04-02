// Initialize Supabase client
// You'll need to replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App state
let accounts = [];
let currentAccountId = null;
let currentUser = null;

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Set up auth event listeners
    document.getElementById('sign-up-btn').addEventListener('click', signUp);
    document.getElementById('sign-in-btn').addEventListener('click', signIn);
    document.getElementById('sign-out-btn').addEventListener('click', signOut);
    
    // Add event listeners for finance features
    document.getElementById('add-account-btn').addEventListener('click', addAccount);
    document.getElementById('transfer-btn').addEventListener('click', transferMoney);
    document.getElementById('save-transaction-btn').addEventListener('click', saveTransaction);
    document.getElementById('save-credit-btn').addEventListener('click', saveCreditBalance);
    
    // Close modal when clicking the X
    document.querySelectorAll('.close-modal').forEach(function(element) {
        element.addEventListener('click', function() {
            document.querySelectorAll('.modal').forEach(function(modal) {
                modal.style.display = 'none';
            });
        });
    });
    
    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        document.querySelectorAll('.modal').forEach(function(modal) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Check if user is already logged in
    checkSession();
});

// ===== AUTHENTICATION FUNCTIONS =====

// Check if user has an active session
async function checkSession() {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
        showAuthMessage(error.message, 'error');
        return;
    }
    
    if (data && data.session) {
        currentUser = data.session.user;
        showAppInterface();
    }
}

// Sign up a new user
async function signUp() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAuthMessage('Please enter both email and password', 'error');
        return;
    }
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });
    
    if (error) {
        showAuthMessage(error.message, 'error');
        return;
    }
    
    showAuthMessage('Sign up successful! Please check your email for verification link.', 'success');
}

// Sign in existing user
async function signIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAuthMessage('Please enter both email and password', 'error');
        return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        showAuthMessage(error.message, 'error');
        return;
    }
    
    currentUser = data.user;
    showAppInterface();
}

// Sign out user
async function signOut() {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
        console.error('Error signing out:', error.message);
        return;
    }
    
    currentUser = null;
    hideAppInterface();
}

// Display auth error/success messages
function showAuthMessage(message, type) {
    const authMessage = document.getElementById('auth-message');
    authMessage.textContent = message;
    authMessage.className = 'auth-message ' + type;
    authMessage.style.display = 'block';
    
    // Clear message after 5 seconds
    setTimeout(() => {
        authMessage.style.display = 'none';
    }, 5000);
}

// Show app interface after successful login
function showAppInterface() {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    document.getElementById('user-email').textContent = currentUser.email;
    
    // Load user's financial data
    loadData();
}

// Hide app interface after logout
function hideAppInterface() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('user-email').textContent = '';
    
    // Clear financial data
    accounts = [];
    renderAccounts();
    updateSummary();
}

// ===== DATA FUNCTIONS =====

// Load data from Supabase
async function loadData() {
    // Fetch accounts from Supabase
    const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', currentUser.id);
    
    if (accountsError) {
        console.error('Error loading accounts:', accountsError.message);
        return;
    }
    
    if (accountsData && accountsData.length > 0) {
        accounts = accountsData;
        
        // Fetch transactions for each account
        for (const account of accounts) {
            if (account.type === 'checking' || account.type === 'savings') {
                const { data: transactionsData, error: transactionsError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('account_id', account.id);
                
                if (transactionsError) {
                    console.error(`Error loading transactions for account ${account.id}:`, transactionsError.message);
                    continue;
                }
                
                account.transactions = transactionsData || [];
            } else {
                account.transactions = [];
            }
        }
    } else {
        accounts = [];
    }
    
    renderAccounts();
    updateSummary();
}

// ===== ACCOUNT FUNCTIONS =====

// Add a new account
async function addAccount() {
    const accountName = document.getElementById('new-account-name').value.trim();
    const accountType = document.getElementById('new-account-type').value;
    
    if (!accountName) {
        alert('Please enter an account name');
        return;
    }
    
    // Insert new account into Supabase
    const { data, error } = await supabase
        .from('accounts')
        .insert([
            {
                user_id: currentUser.id,
                name: accountName,
                type: accountType,
                balance: 0
            }
        ])
        .select();
    
    if (error) {
        console.error('Error creating account:', error.message);
        alert('Error creating account. Please try again.');
        return;
    }
    
    if (data && data.length > 0) {
        const newAccount = data[0];
        newAccount.transactions = [];
        accounts.push(newAccount);
        
        renderAccounts();
        updateSummary();
        
        // Clear the input
        document.getElementById('new-account-name').value = '';
    }
}

// Render all accounts
function renderAccounts() {
    const accountsList = document.getElementById('accounts-list');
    const fromAccount = document.getElementById('from-account');
    const toAccount = document.getElementById('to-account');
    
    // Clear current lists
    accountsList.innerHTML = '';
    fromAccount.innerHTML = '';
    toAccount.innerHTML = '';
    
    accounts.forEach(account => {
        // Create account card
        const accountCard = document.createElement('div');
        accountCard.className = 'account-card';
        
        const accountInfo = document.createElement('div');
        accountInfo.className = 'account-info';
        
        const accountName = document.createElement('div');
        accountName.className = 'account-name';
        accountName.textContent = `${account.name} (${capitalizeFirstLetter(account.type)})`;
        
        const accountBalance = document.createElement('div');
        accountBalance.className = 'account-balance';
        accountBalance.textContent = formatCurrency(account.balance);
        
        accountInfo.appendChild(accountName);
        accountInfo.appendChild(accountBalance);
        
        const accountActions = document.createElement('div');
        accountActions.className = 'account-actions';
        
        // Different actions based on account type
        if (account.type === 'checking' || account.type === 'savings') {
            const viewBtn = document.createElement('button');
            viewBtn.textContent = 'Transactions';
            viewBtn.addEventListener('click', () => showTransactions(account.id));
            accountActions.appendChild(viewBtn);
        } else if (account.type === 'credit') {
            const updateBtn = document.createElement('button');
            updateBtn.textContent = 'Update Balance';
            updateBtn.addEventListener('click', () => showUpdateCredit(account.id));
            accountActions.appendChild(updateBtn);
        }
        
        const renameBtn = document.createElement('button');
        renameBtn.textContent = 'Rename';
        renameBtn.addEventListener('click', () => renameAccount(account.id));
        accountActions.appendChild(renameBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteAccount(account.id));
        accountActions.appendChild(deleteBtn);
        
        accountCard.appendChild(accountInfo);
        accountCard.appendChild(accountActions);
        
        accountsList.appendChild(accountCard);
        
        // Add to transfer dropdowns
        const option1 = document.createElement('option');
        option1.value = account.id;
        option1.textContent = account.name;
        fromAccount.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = account.id;
        option2.textContent = account.name;
        toAccount.appendChild(option2);
    });
}

// Show transactions for an account
function showTransactions(accountId) {
    currentAccountId = accountId;
    const account = accounts.find(a => a.id === accountId);
    
    document.getElementById('modal-title').textContent = `${account.name} Transactions`;
    document.getElementById('transaction-description').value = '';
    document.getElementById('transaction-amount').value = '';
    document.getElementById('transaction-type').value = 'deposit';
    
    renderTransactions(accountId);
    
    document.getElementById('transaction-modal').style.display = 'block';
}

// Render transactions for an account
function renderTransactions(accountId) {
    const transactionsList = document.getElementById('transactions-list');
    transactionsList.innerHTML = '';
    
    const account = accounts.find(a => a.id === accountId);
    
    if (!account.transactions || account.transactions.length === 0) {
        transactionsList.innerHTML = '<p>No transactions yet</p>';
        return;
    }
    
    // Sort transactions by created_at desc
    const sortedTransactions = [...account.transactions].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    sortedTransactions.forEach(transaction => {
        const transactionItem = document.createElement('div');
        transactionItem.className = 'transaction-item';
        
        const description = document.createElement('div');
        description.className = 'transaction-description';
        description.textContent = transaction.description;
        
        const amount = document.createElement('div');
        amount.className = `transaction-amount ${transaction.type}`;
        amount.textContent = transaction.type === 'deposit' ? 
            `+${formatCurrency(transaction.amount)}` : 
            `-${formatCurrency(transaction.amount)}`;
        
        transactionItem.appendChild(description);
        transactionItem.appendChild(amount);
        
        transactionsList.appendChild(transactionItem);
    });
}

// Save a new transaction
async function saveTransaction() {
    const description = document.getElementById('transaction-description').value.trim();
    const amountStr = document.getElementById('transaction-amount').value;
    const type = document.getElementById('transaction-type').value;
    
    if (!description || !amountStr) {
        alert('Please fill in all fields');
        return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const account = accounts.find(a => a.id === currentAccountId);
    
    // Update account balance
    let newBalance = account.balance;
    if (type === 'deposit') {
        newBalance += amount;
    } else {
        if (amount > account.balance) {
            alert('Insufficient funds');
            return;
        }
        newBalance -= amount;
    }
    
    // Start a transaction - update both the account balance and add the transaction
    // First update the account balance
    const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', account.id);
    
    if (updateError) {
        console.error('Error updating account balance:', updateError.message);
        alert('Error updating account. Please try again.');
        return;
    }
    
    // Then insert the transaction
    const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert([
            {
                account_id: account.id,
                description,
                amount,
                type,
                user_id: currentUser.id
            }
        ])
        .select();
    
    if (transactionError) {
        console.error('Error creating transaction:', transactionError.message);
        alert('Error recording transaction. Please try again.');
        
        // Revert the account balance change if transaction insert fails
        await supabase
            .from('accounts')
            .update({ balance: account.balance })
            .eq('id', account.id);
        
        return;
    }
    
    // Update local state
    account.balance = newBalance;
    if (transactionData && transactionData.length > 0) {
        if (!account.transactions) account.transactions = [];
        account.transactions.push(transactionData[0]);
    }
    
    renderTransactions(currentAccountId);
    renderAccounts();
    updateSummary();
    
    // Clear inputs
    document.getElementById('transaction-description').value = '';
    document.getElementById('transaction-amount').value = '';
}

// Show update credit card balance modal
function showUpdateCredit(accountId) {
    currentAccountId = accountId;
    const account = accounts.find(a => a.id === accountId);
    
    document.getElementById('credit-balance').value = account.balance;
    document.getElementById('update-credit-modal').style.display = 'block';
}

// Save credit card balance
async function saveCreditBalance() {
    const balanceStr = document.getElementById('credit-balance').value;
    
    if (!balanceStr) {
        alert('Please enter the current balance');
        return;
    }
    
    const balance = parseFloat(balanceStr);
    if (isNaN(balance) || balance < 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const account = accounts.find(a => a.id === currentAccountId);
    
    // Update account in Supabase
    const { error } = await supabase
        .from('accounts')
        .update({ balance })
        .eq('id', account.id);
    
    if (error) {
        console.error('Error updating credit card balance:', error.message);
        alert('Error updating balance. Please try again.');
        return;
    }
    
    // Update local state
    account.balance = balance;
    
    renderAccounts();
    updateSummary();
    
    document.getElementById('update-credit-modal').style.display = 'none';
}

// Transfer money between accounts
async function transferMoney() {
    const fromId = document.getElementById('from-account').value;
    const toId = document.getElementById('to-account').value;
    const amountStr = document.getElementById('transfer-amount').value;
    
    if (!fromId || !toId || !amountStr) {
        alert('Please fill in all fields');
        return;
    }
    
    if (fromId === toId) {
        alert('Cannot transfer to the same account');
        return;
    }
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }
    
    const fromAccount = accounts.find(a => a.id === fromId);
    const toAccount = accounts.find(a => a.id === toId);
    
    // Check if enough funds
    if (fromAccount.balance < amount) {
        alert('Insufficient funds');
        return;
    }
    
    // Calculate new balances
    const fromNewBalance = fromAccount.balance - amount;
    const toNewBalance = toAccount.balance + amount;
    
    // Start transaction - Update both account balances
    // Update source account
    const { error: fromError } = await supabase
        .from('accounts')
        .update({ balance: fromNewBalance })
        .eq('id', fromId);
    
    if (fromError) {
        console.error('Error updating source account:', fromError.message);
        alert('Error processing transfer. Please try again.');
        return;
    }
    
    // Update destination account
    const { error: toError } = await supabase
        .from('accounts')
        .update({ balance: toNewBalance })
        .eq('id', toId);
    
    if (toError) {
        console.error('Error updating destination account:', toError.message);
        alert('Error processing transfer. Please try again.');
        
        // Revert source account change
        await supabase
            .from('accounts')
            .update({ balance: fromAccount.balance })
            .eq('id', fromId);
        
        return;
    }
    
    // Add transactions for checking and savings accounts
    let fromTransactionPromise = Promise.resolve();
    let toTransactionPromise = Promise.resolve();
    
    if (fromAccount.type !== 'credit') {
        fromTransactionPromise = supabase
            .from('transactions')
            .insert([
                {
                    account_id: fromId,
                    description: `Transfer to ${toAccount.name}`,
                    amount,
                    type: 'withdrawal',
                    user_id: currentUser.id
                }
            ])
            .select();
    }
    
    if (toAccount.type !== 'credit') {
        toTransactionPromise = supabase
            .from('transactions')
            .insert([
                {
                    account_id: toId,
                    description: `Transfer from ${fromAccount.name}`,
                    amount,
                    type: 'deposit',
                    user_id: currentUser.id
                }
            ])
            .select();
    }
    
    // Wait for both transaction inserts to complete
    const [fromTransactionResult, toTransactionResult] = await Promise.all([
        fromTransactionPromise,
        toTransactionPromise
    ]);
    
    // Update local state
    fromAccount.balance = fromNewBalance;
    toAccount.balance = toNewBalance;
    
    // Update transactions in local state if applicable
    if (fromAccount.type !== 'credit' && fromTransactionResult.data && fromTransactionResult.data.length > 0) {
        if (!fromAccount.transactions) fromAccount.transactions = [];
        fromAccount.transactions.push(fromTransactionResult.data[0]);
    }
    
    if (toAccount.type !== 'credit' && toTransactionResult.data && toTransactionResult.data.length > 0) {
        if (!toAccount.transactions) toAccount.transactions = [];
        toAccount.transactions.push(toTransactionResult.data[0]);
    }
    
    renderAccounts();
    updateSummary();
    
    // Clear input
    document.getElementById('transfer-amount').value = '';
    
    alert('Transfer completed successfully');
}

// Rename account
async function renameAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    const newName = prompt('Enter new name for the account:', account.name);
    
    if (!newName || newName.trim() === '') {
        return;
    }
    
    // Update account in Supabase
    const { error } = await supabase
        .from('accounts')
        .update({ name: newName.trim() })
        .eq('id', accountId);
    
    if (error) {
        console.error('Error renaming account:', error.message);
        alert('Error renaming account. Please try again.');
        return;
    }
    
    // Update local state
    account.name = newName.trim();
    
    renderAccounts();
}

// Delete account
async function deleteAccount(accountId) {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
        return;
    }
    
    const account = accounts.find(a => a.id === accountId);
    
    // First delete all transactions for this account if it's a checking or savings account
    if (account.type === 'checking' || account.type === 'savings') {
        const { error: transactionError } = await supabase
            .from('transactions')
            .delete()
            .eq('account_id', accountId);
        
        if (transactionError) {
            console.error('Error deleting transactions:', transactionError.message);
            alert('Error deleting account. Please try again.');
            return;
        }
    }
    
    // Then delete the account
    const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);
    
    if (error) {
        console.error('Error deleting account:', error.message);
        alert('Error deleting account. Please try again.');
        return;
    }
    
    // Update local state
    accounts = accounts.filter(a => a.id !== accountId);
    
    renderAccounts();
    updateSummary();
}

// Update summary section showing total cash, credit debt, and net worth
function updateSummary() {
    let totalCash = 0;
    let totalCredit = 0;
    
    accounts.forEach(account => {
        if (account.type === 'checking' || account.type === 'savings') {
            totalCash += account.balance;
        } else if (account.type === 'credit') {
            totalCredit += account.balance;
        }
    });
    
    const netWorth = totalCash - totalCredit;
    
    document.getElementById('total-cash').textContent = formatCurrency(totalCash);
    document.getElementById('total-credit').textContent = formatCurrency(totalCredit);
    document.getElementById('net-worth').textContent = formatCurrency(netWorth);
    
    // Set color for net worth (green for positive, red for negative)
    const netWorthElement = document.getElementById('net-worth');
    if (netWorth >= 0) {
        netWorthElement.classList.remove('negative');
        netWorthElement.classList.add('positive');
    } else {
        netWorthElement.classList.remove('positive');
        netWorthElement.classList.add('negative');
    }
}

// Format currency for display
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Capitalize first letter of a string
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Show transfer modal
function showTransferModal() {
    document.getElementById('transfer-modal').style.display = 'block';
}

// Initialize Supabase schema (call this once to set up the database tables)
async function initializeDatabase() {
    console.log("Creating database schema...");
    
    // This function would typically be run once by an admin
    // or as part of your application's first-time setup
    
    // You would need to have Supabase RLS policies configured properly
    // for these table operations to work
    
    // Create accounts table
    const { error: accountsError } = await supabase.rpc('create_accounts_table');
    
    if (accountsError) {
        console.error('Error creating accounts table:', accountsError.message);
    }
    
    // Create transactions table
    const { error: transactionsError } = await supabase.rpc('create_transactions_table');
    
    if (transactionsError) {
        console.error('Error creating transactions table:', transactionsError.message);
    }
    
    console.log("Database schema creation complete.");
}

// Example of how to define RPC functions in Supabase
// You would implement these in your Supabase SQL editor:
/*
-- Create accounts table function
create or replace function create_accounts_table()
returns void as $$
begin
  create table if not exists accounts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    name text not null,
    type text not null check (type in ('checking', 'savings', 'credit')),
    balance numeric not null default 0,
    created_at timestamp with time zone default now()
  );
  
  -- Set up RLS (Row Level Security)
  alter table accounts enable row level security;
  
  -- Create policy for users to only see their own accounts
  create policy "Users can view their own accounts"
    on accounts for select
    using (auth.uid() = user_id);
    
  create policy "Users can insert their own accounts"
    on accounts for insert
    with check (auth.uid() = user_id);
    
  create policy "Users can update their own accounts"
    on accounts for update
    using (auth.uid() = user_id);
    
  create policy "Users can delete their own accounts"
    on accounts for delete
    using (auth.uid() = user_id);
end;
$$ language plpgsql security definer;

-- Create transactions table function
create or replace function create_transactions_table()
returns void as $$
begin
  create table if not exists transactions (
    id uuid default uuid_generate_v4() primary key,
    account_id uuid references accounts not null,
    user_id uuid references auth.users not null,
    description text not null,
    amount numeric not null check (amount > 0),
    type text not null check (type in ('deposit', 'withdrawal')),
    created_at timestamp with time zone default now()
  );
  
  -- Set up RLS (Row Level Security)
  alter table transactions enable row level security;
  
  -- Create policy for users to only see their own transactions
  create policy "Users can view their own transactions"
    on transactions for select
    using (auth.uid() = user_id);
    
  create policy "Users can insert their own transactions"
    on transactions for insert
    with check (auth.uid() = user_id);
end;
$$ language plpgsql security definer;
*/
