# Chase Bank Skill

How to automate Chase banking tasks using browser_script and browser_navigate.

## Setup
Chase URL: `https://chase.com`
Dashboard: `https://secure.chase.com/web/auth/dashboard`
Statements: Navigate from dashboard → select account → Statements

## Navigate to statements
1. browser_navigate to `https://secure.chase.com/web/auth/dashboard`
2. If prompted to log in, the user should already be authenticated via Chrome CDP
3. Use browser_get_page to see available accounts
4. Click the desired account to view its details
5. Look for "Statements" link/tab

## Download a statement PDF
Chase typically shows statements as links. Use browser_script:
```javascript
// Find statement links on the statements page
const links = [...document.querySelectorAll('a')].filter(a =>
  a.textContent?.includes('Statement') || a.href?.includes('statement'));
return links.map(a => ({ text: a.textContent?.trim(), href: a.href }));
```

## List accounts
From the dashboard:
```javascript
// Get all account tiles/cards
const accounts = [...document.querySelectorAll('[data-testid*="account"], .account-tile, .card-container')]
  .map(el => ({
    name: el.querySelector('h3, h4, .account-name')?.textContent?.trim(),
    balance: el.querySelector('.balance, .amount')?.textContent?.trim(),
  }));
return accounts;
```

## Notes
- Chase has aggressive bot detection. If blocked, fall back to screen_control.
- Session may expire — check for login prompts.
- Chase may show security verification (text/email code). The agent should report this and wait.
- Statement PDFs download to the default downloads folder. Use shell_exec to find and process them.
- To extract transactions from PDF statements, use: `shell_exec` with a PDF parsing tool.
