import assert from 'node:assert/strict';
import test from 'node:test';
import { isSameOriginLoopbackRequest } from '../src/kernel/requestSecurity.ts';

const localRequest = {
  origin: 'http://127.0.0.1:3000',
  host: '127.0.0.1:3000',
  remoteAddress: '127.0.0.1',
  secFetchSite: 'same-origin',
};

test('allows same-origin browser requests from loopback', () => {
  assert.equal(isSameOriginLoopbackRequest(localRequest), true);
  assert.equal(isSameOriginLoopbackRequest({
    ...localRequest,
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    remoteAddress: '::ffff:127.0.0.1',
  }), true);
});

test('rejects remote, cross-origin, and non-browser requests', () => {
  assert.equal(isSameOriginLoopbackRequest({ ...localRequest, remoteAddress: '192.168.1.5' }), false);
  assert.equal(isSameOriginLoopbackRequest({ ...localRequest, origin: 'http://evil.example' }), false);
  assert.equal(isSameOriginLoopbackRequest({ ...localRequest, secFetchSite: 'cross-site' }), false);
  assert.equal(isSameOriginLoopbackRequest({ ...localRequest, secFetchSite: undefined }), false);
  assert.equal(isSameOriginLoopbackRequest({ ...localRequest, origin: 'null' }), false);
});
