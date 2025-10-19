chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'showSelectionInSidePanel') {
    const contentDiv = document.getElementById('translation-content');
    if (contentDiv) {
      contentDiv.textContent = request.text;
    }
  }
});
