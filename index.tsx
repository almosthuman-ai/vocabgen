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
  const originalAppendChild = prototype.appendChild;
  const originalSetAttribute = (Element.prototype as Element & {
    _originalSetAttribute?: typeof Element.prototype.setAttribute;
  })._originalSetAttribute ?? Element.prototype.setAttribute;

  const translateClassPattern = /goog-te|gtx|notranslate|\btranslated\b/i;
  const forbiddenAttributes = new Set([
    'data-gtm-translate',
    'data-google-translate-enabled',
  ]);
  const forbiddenTagNames = new Set([
    'goog-te-banner-frame',
    'goog-te-balloon-frame',
  ]);

  const sanitizeNode = (node: Node) => {
    if (!(node instanceof Element)) {
      return;
    }

    const classAttr = node.getAttribute('class') ?? '';
    if (translateClassPattern.test(classAttr)) {
      node.setAttribute('class', classAttr.replace(translateClassPattern, '')); // strip injected classes
    }

    forbiddenAttributes.forEach(attr => {
      if (node.hasAttribute(attr)) {
        node.removeAttribute(attr);
      }
    });
  };

  const destroyForbiddenNodes = (node: Node) => {
    if (node instanceof Element && forbiddenTagNames.has(node.tagName.toLowerCase())) {
      node.remove();
      console.warn('[vocabgen] Removed translate overlay node', node);
      return true;
    }
    return false;
  };

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

  prototype.appendChild = function patchedAppendChild<T extends Node>(this: Node, child: T): T {
    if (destroyForbiddenNodes(child)) {
      return child;
    }

    sanitizeNode(child);
    return originalAppendChild.call(this, child);
  };

  Element.prototype.setAttribute = function patchedSetAttribute(this: Element, qualifiedName: string, value: string) {
    if (forbiddenAttributes.has(qualifiedName)) {
      console.warn('[vocabgen] Blocked translate attribute mutation', { node: this, qualifiedName, value });
      return;
    }

    if (qualifiedName === 'class' && translateClassPattern.test(value)) {
      const cleansed = value.replace(translateClassPattern, '');
      console.warn('[vocabgen] Stripped translate class injection', { node: this, value, cleansed });
      return originalSetAttribute.call(this, qualifiedName, cleansed);
    }

    return originalSetAttribute.call(this, qualifiedName, value);
  };

  const mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (destroyForbiddenNodes(node)) {
          return;
        }
        sanitizeNode(node);
      });

      if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        const target = mutation.target;
        if (forbiddenAttributes.has(mutation.attributeName ?? '')) {
          target.removeAttribute(mutation.attributeName!);
          console.warn('[vocabgen] Removed forbidden attribute from mutation', { target, attribute: mutation.attributeName });
        }

        if (mutation.attributeName === 'class') {
          const classValue = target.getAttribute('class') ?? '';
          if (translateClassPattern.test(classValue)) {
            target.setAttribute('class', classValue.replace(translateClassPattern, ''));
            console.warn('[vocabgen] Sanitized class mutation from translate injection', { target, classValue });
          }
        }
      }
    });
  });

  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', ...forbiddenAttributes],
  });
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
