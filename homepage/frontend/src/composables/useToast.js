/**
 * useToast composable — toast(), confirm(), prompt() using wa-alert and wa-dialog
 */

let toastContainer = null;

function getToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;
  
  toastContainer = document.createElement('div');
  toastContainer.className = 'custom-toast-container';
  
  // Inject styling directly into document head if not already present
  if (!document.getElementById('custom-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-toast-styles';
    style.textContent = `
      .custom-toast-container {
        position: fixed;
        top: 1.5rem;
        right: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        z-index: 10000;
        max-width: 420px;
        width: calc(100% - 3rem);
        pointer-events: none;
      }
      .custom-toast-item {
        pointer-events: auto;
        animation: toast-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition: opacity 0.3s ease, transform 0.3s ease, margin 0.3s ease, height 0.3s ease;
        box-shadow: var(--wa-shadow-large);
        border-radius: var(--wa-border-radius-medium);
        overflow: hidden;
      }
      .custom-toast-item.toast-hide {
        opacity: 0;
        transform: translateX(110%);
      }
      .toast-content-wrapper {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.75rem;
        width: 100%;
        color: var(--wa-color-neutral-10);
      }
      .toast-message {
        flex: 1;
        line-height: 1.5;
        font-size: 0.95rem;
        font-weight: 500;
      }
      .toast-close-btn {
        margin: -0.2rem -0.4rem 0 0;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
        color: inherit;
      }
      .toast-close-btn:hover {
        opacity: 1;
      }
      @keyframes toast-slide-in {
        from {
          opacity: 0;
          transform: translateX(110%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * Show a toast notification using a custom wa-callout container
 * @param {string} message
 * @param {'primary'|'success'|'neutral'|'warning'|'danger'} variant
 * @param {number} duration - auto-close after ms (0 = manual close only)
 */
export async function toast(message, variant = 'primary', duration = 3000) {
  // Wait for the custom element to be defined (may not be ready on early page load)
  await customElements.whenDefined('wa-callout');

  const container = getToastContainer();
  
  const toastItem = document.createElement('div');
  toastItem.className = 'custom-toast-item';
  
  const callout = document.createElement('wa-callout');
  callout.setAttribute('variant', variant === 'primary' ? 'brand' : variant);
  callout.setAttribute('appearance', 'filled-outlined');
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'toast-content-wrapper';
  
  // Icon
  const icon = document.createElement('wa-icon');
  icon.setAttribute('slot', 'icon');
  icon.setAttribute('name', getIcon(variant));
  callout.appendChild(icon);
  
  // Message text
  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message;
  contentWrapper.appendChild(messageSpan);
  
  // Close button
  const closeBtn = document.createElement('wa-button');
  closeBtn.setAttribute('appearance', 'plain');
  closeBtn.setAttribute('size', 'small');
  closeBtn.className = 'toast-close-btn';
  
  const closeIcon = document.createElement('wa-icon');
  closeIcon.setAttribute('name', 'x');
  closeBtn.appendChild(closeIcon);
  contentWrapper.appendChild(closeBtn);
  
  callout.appendChild(contentWrapper);
  toastItem.appendChild(callout);
  container.appendChild(toastItem);
  
  let isClosed = false;
  const closeToast = () => {
    if (isClosed) return;
    isClosed = true;
    toastItem.classList.add('toast-hide');
    setTimeout(() => {
      toastItem.remove();
      // Remove container if it has no children left
      if (container.children.length === 0) {
        container.remove();
        toastContainer = null;
      }
    }, 300);
  };
  
  closeBtn.addEventListener('click', closeToast);
  
  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
}

/** Convenience wrappers */
toast.success = (msg) => toast(msg, 'success');
toast.error = (msg) => toast(msg, 'danger', 5000);
toast.warning = (msg) => toast(msg, 'warning', 4000);
toast.info = (msg) => toast(msg, 'primary');

function getIcon(variant) {
  switch (variant) {
    case 'success': return 'check-circle';
    case 'danger': return 'x-circle';
    case 'warning': return 'exclamation-triangle';
    default: return 'info-circle';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show a confirmation dialog using wa-dialog
 * @param {string} message
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export function confirm(message, title = 'Bestätigung') {
  return new Promise((resolve) => {
    const dialog = document.createElement('wa-dialog');
    dialog.label = title;

    const p = document.createElement('p');
    p.style.cssText = 'margin:0; line-height:1.5';
    p.textContent = message;
    dialog.appendChild(p);

    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.style.cssText = 'display:flex; gap:0.5rem; justify-content:flex-end';

    const cancelBtn = document.createElement('wa-button');
    cancelBtn.size = 'small';
    cancelBtn.setAttribute('appearance', 'filled');
    cancelBtn.textContent = 'Abbrechen';

    const confirmBtn = document.createElement('wa-button');
    confirmBtn.size = 'small';
    confirmBtn.setAttribute('variant', 'primary');
    confirmBtn.textContent = 'OK';

    footer.append(cancelBtn, confirmBtn);
    dialog.appendChild(footer);
    document.body.appendChild(dialog);

    const cleanup = (result) => {
      dialog.removeEventListener('wa-after-hide', onHide);
      dialog.remove();
      resolve(result);
    };

    const onHide = () => cleanup(false);
    dialog.addEventListener('wa-after-hide', onHide);

    cancelBtn.addEventListener('click', () => {
      dialog.open = false;
    });
    confirmBtn.addEventListener('click', () => {
      dialog.removeEventListener('wa-after-hide', onHide);
      dialog.open = false;
      dialog.addEventListener('wa-after-hide', () => cleanup(true), { once: true });
    });

    requestAnimationFrame(() => { dialog.open = true; });
  });
}

/**
 * Show a prompt dialog with an input field
 * @param {string} message
 * @param {string} title
 * @param {string} defaultValue
 * @returns {Promise<string|null>}
 */
export function prompt(message, title = 'Eingabe', defaultValue = '') {
  return new Promise((resolve) => {
    const dialog = document.createElement('wa-dialog');
    dialog.label = title;

    const p = document.createElement('p');
    p.style.cssText = 'margin:0 0 1rem; line-height:1.5';
    p.textContent = message;
    dialog.appendChild(p);

    const input = document.createElement('wa-input');
    input.value = defaultValue;
    input.autofocus = true;
    dialog.appendChild(input);

    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.style.cssText = 'display:flex; gap:0.5rem; justify-content:flex-end';

    const cancelBtn = document.createElement('wa-button');
    cancelBtn.size = 'small';
    cancelBtn.setAttribute('appearance', 'filled');
    cancelBtn.textContent = 'Abbrechen';

    const confirmBtn = document.createElement('wa-button');
    confirmBtn.size = 'small';
    confirmBtn.setAttribute('variant', 'primary');
    confirmBtn.textContent = 'OK';

    footer.append(cancelBtn, confirmBtn);
    dialog.appendChild(footer);
    document.body.appendChild(dialog);

    const cleanup = (result) => {
      dialog.removeEventListener('wa-after-hide', onHide);
      dialog.remove();
      resolve(result);
    };

    const onHide = () => cleanup(null);
    dialog.addEventListener('wa-after-hide', onHide);

    cancelBtn.addEventListener('click', () => {
      dialog.open = false;
    });

    const submit = () => {
      const value = input.value;
      dialog.removeEventListener('wa-after-hide', onHide);
      dialog.open = false;
      dialog.addEventListener('wa-after-hide', () => cleanup(value), { once: true });
    };

    confirmBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });

    requestAnimationFrame(() => { dialog.open = true; });
  });
}

/**
 * Show a prominent error dialog using wa-dialog
 * @param {string} message
 * @param {string} title
 * @returns {Promise<void>}
 */
const activeErrorMessages = new Set();

export function showErrorDialog(message, title = 'Fehler') {
  if (!message) return Promise.resolve();
  if (activeErrorMessages.has(message)) return Promise.resolve();
  activeErrorMessages.add(message);

  return new Promise((resolve) => {
    const dialog = document.createElement('wa-dialog');
    dialog.label = title;

    const content = document.createElement('div');
    content.style.cssText = 'display:flex; align-items:flex-start; gap:1rem;';
    
    const icon = document.createElement('wa-icon');
    icon.name = 'exclamation-circle';
    icon.style.cssText = 'color: var(--wa-color-danger-50); font-size: 2rem; flex-shrink: 0;';
    content.appendChild(icon);

    const p = document.createElement('p');
    p.style.cssText = 'margin:0; line-height:1.5; color: var(--wa-color-neutral-10); max-width: 400px;';
    p.textContent = message.replace(/^Validation failed:\s*/i, '');
    content.appendChild(p);

    dialog.appendChild(content);

    const footer = document.createElement('div');
    footer.slot = 'footer';
    footer.style.cssText = 'display:flex; justify-content:flex-end';

    const confirmBtn = document.createElement('wa-button');
    confirmBtn.size = 'small';
    confirmBtn.setAttribute('variant', 'primary');
    confirmBtn.textContent = 'Verstanden';

    footer.append(confirmBtn);
    dialog.appendChild(footer);
    document.body.appendChild(dialog);

    const cleanup = () => {
      activeErrorMessages.delete(message);
      dialog.removeEventListener('wa-after-hide', onHide);
      dialog.remove();
      resolve();
    };

    const onHide = () => cleanup();
    dialog.addEventListener('wa-after-hide', onHide);

    confirmBtn.addEventListener('click', () => {
      dialog.open = false;
    });

    requestAnimationFrame(() => { dialog.open = true; });
  });
}
