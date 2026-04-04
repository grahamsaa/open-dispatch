import { describe, it, expect } from 'vitest';
import { parseScreenAction, type ScreenAction } from './screen.js';

describe('screen parseScreenAction', () => {
  it('parses click action', () => {
    const action = parseScreenAction('{"action": "click", "x": 500, "y": 300}');
    expect(action).toEqual({ action: 'click', x: 500, y: 300 });
  });

  it('parses type action', () => {
    const action = parseScreenAction('{"action": "type", "text": "hello world"}');
    expect(action).toEqual({ action: 'type', text: 'hello world' });
  });

  it('parses key action', () => {
    const action = parseScreenAction('{"action": "key", "key": "cmd+c"}');
    expect(action).toEqual({ action: 'key', key: 'cmd+c' });
  });

  it('parses scroll action', () => {
    const action = parseScreenAction('{"action": "scroll", "x": 640, "y": 400, "direction": "down", "clicks": 5}');
    expect(action).toEqual({ action: 'scroll', x: 640, y: 400, direction: 'down', clicks: 5 });
  });

  it('parses drag action', () => {
    const action = parseScreenAction('{"action": "drag", "fromX": 100, "fromY": 200, "toX": 300, "toY": 400}');
    expect(action).toEqual({ action: 'drag', fromX: 100, fromY: 200, toX: 300, toY: 400 });
  });

  it('parses done action', () => {
    const action = parseScreenAction('{"action": "done", "result": "Opened the folder"}');
    expect(action).toEqual({ action: 'done', result: 'Opened the folder' });
  });

  it('parses from code block', () => {
    const action = parseScreenAction('Let me click:\n```json\n{"action": "double_click", "x": 250, "y": 180}\n```');
    expect(action).toEqual({ action: 'double_click', x: 250, y: 180 });
  });

  it('parses from text with surrounding content', () => {
    const action = parseScreenAction('I see the button at coordinates {"action": "click", "x": 100, "y": 50} and will click it.');
    expect(action).toEqual({ action: 'click', x: 100, y: 50 });
  });

  it('returns null for invalid input', () => {
    expect(parseScreenAction('I cannot do that')).toBeNull();
  });

  it('returns null for JSON without action', () => {
    expect(parseScreenAction('{"x": 100, "y": 200}')).toBeNull();
  });

  it('parses wait action', () => {
    const action = parseScreenAction('{"action": "wait", "ms": 3000}');
    expect(action).toEqual({ action: 'wait', ms: 3000 });
  });

  it('parses right_click', () => {
    const action = parseScreenAction('{"action": "right_click", "x": 400, "y": 500}');
    expect(action).toEqual({ action: 'right_click', x: 400, y: 500 });
  });
});
