import { describe, it, expect } from 'vitest';
import { _parseAction } from './browser.js';

describe('browser parseAction', () => {
  it('parses raw JSON', () => {
    const action = _parseAction('{"action": "click", "selector": "#btn"}');
    expect(action).toEqual({ action: 'click', selector: '#btn' });
  });

  it('parses JSON in code block', () => {
    const action = _parseAction('Here is what to do:\n```json\n{"action": "fill", "selector": "input", "value": "hello"}\n```');
    expect(action).toEqual({ action: 'fill', selector: 'input', value: 'hello' });
  });

  it('parses JSON embedded in text', () => {
    const action = _parseAction('I think we should {"action": "navigate", "url": "https://example.com"} to that page.');
    expect(action).toEqual({ action: 'navigate', url: 'https://example.com' });
  });

  it('parses done action', () => {
    const action = _parseAction('{"action": "done", "result": "Found the data"}');
    expect(action).toEqual({ action: 'done', result: 'Found the data' });
  });

  it('parses fail action', () => {
    const action = _parseAction('{"action": "fail", "reason": "Page not found"}');
    expect(action).toEqual({ action: 'fail', reason: 'Page not found' });
  });

  it('returns null for non-JSON', () => {
    expect(_parseAction('Just some text')).toBeNull();
  });

  it('returns null for JSON without action field', () => {
    expect(_parseAction('{"selector": "#btn"}')).toBeNull();
  });

  it('handles scroll action', () => {
    const action = _parseAction('{"action": "scroll", "direction": "down"}');
    expect(action).toEqual({ action: 'scroll', direction: 'down' });
  });

  it('handles press action', () => {
    const action = _parseAction('{"action": "press", "key": "Enter"}');
    expect(action).toEqual({ action: 'press', key: 'Enter' });
  });

  it('handles wait action', () => {
    const action = _parseAction('{"action": "wait", "ms": 2000}');
    expect(action).toEqual({ action: 'wait', ms: 2000 });
  });
});
