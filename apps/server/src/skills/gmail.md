# Gmail Skill

How to automate Gmail tasks using browser_script. IMPORTANT: All scripts must be wrapped in an IIFE since page.evaluate does not allow bare return statements.

## Setup
Gmail URL pattern: `https://mail.google.com/mail/u/{account_index}/`
- Account 0 is the first signed-in account, 1 is the second, etc.
- To verify the right account, check the page title after navigating — it shows the email address.

## Complete workflow: search and delete all from a sender

Follow these steps IN ORDER. Do not skip steps or combine them. Wait for each step to succeed before proceeding.

### Step 1: Navigate to search results
Use browser_script to go to the search URL:
```javascript
(function() { window.location.href = 'https://mail.google.com/mail/u/0/#search/from%3A{encoded_sender}'; return 'Navigating to search'; })()
```
Then use a separate browser_script call to wait and verify:
```javascript
(function() { return document.title + ' | URL: ' + window.location.href; })()
```

### Step 2: Click the "Select all" checkbox
This selects conversations on the current page (up to 50).
```javascript
(function() {
  var cb = document.querySelector('div[role="checkbox"][aria-label="Select"]')
    || document.querySelector('div.T-Jo-J7[role="checkbox"]')
    || document.querySelector('span.T-Jo-auh');
  if (cb) { cb.click(); return 'Clicked select-all checkbox'; }
  return 'ERROR: Could not find select-all checkbox';
})()
```

### Step 3: Wait 1-2 seconds, then click "Select all conversations that match this search"
After clicking the checkbox, Gmail shows a yellow bar with a link like "Select all conversations that match this search". You MUST click it to select ALL results beyond the first 50.
```javascript
(function() {
  var links = document.querySelectorAll('span a');
  for (var i = 0; i < links.length; i++) {
    if (links[i].textContent && links[i].textContent.indexOf('Select all') !== -1) {
      links[i].click();
      return 'Clicked: ' + links[i].textContent.trim();
    }
  }
  var allEls = document.querySelectorAll('span, a, div');
  for (var j = 0; j < allEls.length; j++) {
    var text = allEls[j].textContent || '';
    if (text.indexOf('Select all conversations') !== -1 && allEls[j].offsetParent !== null) {
      allEls[j].click();
      return 'Clicked (fallback): ' + text.trim().substring(0, 80);
    }
  }
  return 'No "Select all conversations" link found - may only have <=50 results (OK to proceed)';
})()
```
NOTE: If there are 50 or fewer results, this link may NOT appear. That is fine — proceed to deletion.

### Step 4: Wait 1 second, then click Delete
```javascript
(function() {
  var del = document.querySelector('div[aria-label="Delete"]')
    || document.querySelector('button[aria-label="Delete"]');
  if (del) { del.click(); return 'Clicked delete button'; }
  return 'ERROR: Could not find delete button';
})()
```

### Step 5: Handle confirmation dialog (if any)
If deleting many conversations, Gmail may show a confirmation dialog. Click OK/Confirm.
```javascript
(function() {
  var okBtn = document.querySelector('button[name="ok"]');
  if (!okBtn) {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].textContent && buttons[i].textContent.trim() === 'OK') { okBtn = buttons[i]; break; }
    }
  }
  if (okBtn) { okBtn.click(); return 'Confirmed deletion'; }
  return 'No confirmation dialog (already deleted)';
})()
```

### Step 6: Verify
Wait 2 seconds, then check the page to confirm the search now shows fewer or no results. If results remain, REPEAT from Step 2 (Gmail may require multiple passes for large mailboxes).

## Search for emails
Navigate directly to a search URL — this is the most reliable method:
`https://mail.google.com/mail/u/0/#search/from%3A{encoded_sender}`

URL encoding: spaces become `+`, special chars use `%XX`. Examples:
- `from:john@example.com` → `from%3Ajohn%40example.com`
- `from:Accurate Arms USA` → `from%3AAccurate+Arms+USA`

## Other operations

### Apply a label
```javascript
(function() { document.querySelector('div[aria-label="Labels"]')?.click(); return 'Opened labels dropdown'; })()
```

### Mark as read
```javascript
(function() { document.querySelector('div[aria-label="Mark as read"]')?.click(); return 'Marked as read'; })()
```

### Archive
```javascript
(function() { document.querySelector('div[aria-label="Archive"]')?.click(); return 'Archived'; })()
```

## Multi-account handling
- Check current account: look at page title or URL (`/mail/u/0/` vs `/mail/u/1/`)
- Switch accounts by navigating to `https://mail.google.com/mail/u/{index}/`

## Troubleshooting
- If selectors don't work, use browser_get_page to see current page state
- Gmail changes its DOM frequently — if a selector fails, try aria-label selectors first (most stable)
- Scripts with bare `return` will fail with SyntaxError — ALWAYS use `(function() { ... })()`
- If the page seems empty, wait longer (2-3 seconds) — Gmail loads asynchronously
