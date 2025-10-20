const form = document.getElementById('settings-form') as HTMLFormElement;
const endpointInput = document.getElementById('endpoint') as HTMLInputElement;
const en2jaModelInput = document.getElementById('en2ja-model') as HTMLInputElement;
const ja2enModelInput = document.getElementById('ja2en-model') as HTMLInputElement;
const summarizeModelInput = document.getElementById('summarize-model') as HTMLInputElement;
const status = document.getElementById('status');

// Saves options to chrome.storage
const saveOptions = () => {
  const endpoint = endpointInput.value;
  const en2jaModel = en2jaModelInput.value;
  const ja2enModel = ja2enModelInput.value;
  const summarizeModel = summarizeModelInput.value;

  chrome.storage.local.set(
    {
      endpoint,
      en2jaModel,
      ja2enModel,
      summarizeModel,
    },
    () => {
      // Update status to let user know options were saved.
      if (status) {
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 750);
      }
    }
  );
};

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.local.get(
    ['endpoint', 'en2jaModel', 'ja2enModel', 'summarizeModel'],
    (items) => {
      endpointInput.value = items.endpoint || '';
      en2jaModelInput.value = items.en2jaModel || '';
      ja2enModelInput.value = items.ja2enModel || '';
      summarizeModelInput.value = items.summarizeModel || '';
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);
form.addEventListener('submit', (e) => {
  e.preventDefault();
  saveOptions();
});