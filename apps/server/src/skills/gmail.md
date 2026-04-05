# Gmail Skill

How to automate Gmail tasks using browser_script and browser_navigate.

## Setup
Gmail URL pattern: `https://mail.google.com/mail/u/{account_index}/`
- Account 0 is the first signed-in account, 1 is the second, etc.
- To find the right account, navigate to `https://mail.google.com` and check the page title which shows the email address.

## Search for emails
Use browser_script to search Gmail:
```javascript
// Fill search box and submit
const searchBox = document.querySelector('input[aria-label="Search mail"]');
if (searchBox) {
  searchBox.value = 'from:sender@example.com';
  searchBox.dispatchEvent(new Event('input', { bubbles: true }));
  searchBox.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true }));
}
```
Or navigate directly to a search URL:
`https://mail.google.com/mail/u/0/#search/from%3Asender+name`

## Select all conversations matching a search
After searching, use browser_script:
```javascript
// Step 1: Click the "Select all" checkbox in the toolbar
const selectAll = document.querySelector('div[aria-label="Select"][role="checkbox"]')
  || document.querySelector('span.T-Jo-auh'); // fallback selector
if (selectAll) selectAll.click();
```

Then look for the "Select all conversations that match this search" link and click it:
```javascript
// Step 2: Click "Select all conversations that match this search"
const selectAllLink = [...document.querySelectorAll('span')].find(el =>
  el.textContent?.includes('Select all conversations'));
if (selectAllLink) selectAllLink.click();
```

## Delete selected emails
```javascript
// Click the delete button (trash icon)
const deleteBtn = document.querySelector('div[aria-label="Delete"]')
  || document.querySelector('button[aria-label="Delete"]');
if (deleteBtn) deleteBtn.click();
```

## Complete workflow: search and delete all from a sender
1. Navigate to: `https://mail.google.com/mail/u/0/#search/from%3A{encoded_sender}`
2. Wait 3 seconds for results to load
3. Run browser_script to click "Select all" checkbox
4. Wait 1 second
5. Run browser_script to click "Select all conversations that match this search"
6. Wait 1 second
7. Run browser_script to click Delete button
8. Verify with browser_get_page that the deletion happened

## Apply a label
```javascript
// Click "Label" button, then select the label
document.querySelector('div[aria-label="Labels"]')?.click();
// Wait, then click the specific label in the dropdown
```

## Mark as read
```javascript
document.querySelector('div[aria-label="Mark as read"]')?.click();
```

## Archive
```javascript
document.querySelector('div[aria-label="Archive"]')?.click();
```

## Multi-account handling
- Check current account: look at page title or URL (`/mail/u/0/` vs `/mail/u/1/`)
- Switch accounts by navigating to `https://mail.google.com/mail/u/{index}/`
- The account index is determined by sign-in order, not alphabetically
