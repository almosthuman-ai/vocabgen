import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // <--- ADD THIS LINE HERE
import App from './App';

const installDomMutationGuards = () => {
  const guardToken = Symbol.for('vocabgen.domGuarded');
  const prototype = Node.prototype as Node & Record<symbol, unknown>;

  if (prototype[guardToken]) {
    return;
  }

  Object.defineProperty(prototype, guardToken, {
    value: true,
    configurable: false,
    enumerable: false,
  });

  const originalRemoveChild = prototype.removeChild;
  const originalInsertBefore = prototype.insertBefore;

  prototype.removeChild = function patchedRemoveChild<T extends Node>(this: Node, child: T): T {
    if (!child) {
      return child;
    }

    if (child.parentNode !== this) {
      console.warn('[vocabgen] Suppressed removeChild on detached node', { parent: this, child });
      return child;
    }

    try {
      return originalRemoveChild.call(this, child);
    } catch (error) {
      console.warn('[vocabgen] Caught removeChild mismatch from extension interference', { parent: this, child, error });
      return child;
    }
  };

  prototype.insertBefore = function patchedInsertBefore<T extends Node>(
    this: Node,
    newChild: T,
    refChild: Node | null,
  ): T {
    if (refChild && refChild.parentNode !== this) {
      console.warn('[vocabgen] Suppressed insertBefore using foreign reference node', { parent: this, newChild, refChild });
      return newChild;
    }

    try {
      return originalInsertBefore.call(this, newChild, refChild);
    } catch (error) {
      console.warn('[vocabgen] Caught insertBefore mismatch from extension interference', { parent: this, newChild, refChild, error });
      return newChild;
    }
  };
};

installDomMutationGuards();

/*
Manual verification playbook:
1. Mount the app and run `document.querySelector('#root')?.firstChild?.remove();` from DevTools to simulate an extension removing nodes.
2. Confirm the console logs a single vocabgen warning and the app continues rendering without a crash.
*/

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
