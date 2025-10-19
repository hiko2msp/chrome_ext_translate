chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === 'translatePage') {
    translatePage(request.sourceLang, request.targetLang);
  }
});


const skipTags = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'CODE', 'PRE']);

async function translatePage(sourceLang: string, targetLang: string) {
  // ... (The rest of the file is the same)
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    // Skip empty or whitespace‑only text nodes
    if (!node.nodeValue || node.nodeValue.trim() === '') continue;

    // Skip text inside elements that are not user‑visible (e.g., <style>, <script>, etc.)
    const parent = (node.parentElement?.tagName ?? '').toUpperCase();
    if (skipTags.has(parent)) continue;

    textNodes.push(node as Text);
  }

  // Cache for already‑translated texts
  const translationCache = new Map<string, string>();

  for (const node of textNodes) {
    const originalText = node.nodeValue!.trim();

    // Return cached result if we have it
    if (translationCache.has(originalText)) {
      if (translationCache.get(originalText) !== '') {
        node.nodeValue = translationCache.get(originalText)!;
      }
      continue;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: originalText,
        sourceLang,
        targetLang,
      });
      console.log('Translated ', originalText, response);

      if (response.translatedText) {
        console.log('Translated text:', originalText, response.translatedText);
        // Store in cache and replace node value
        translationCache.set(originalText, response.translatedText);
        node.nodeValue = response.translatedText;
      } else if (response.translatedText === '') {
        translationCache.set(originalText, response.translatedText);
      } else if (response.error) {
        console.error('Translation failed:', response.error);
      }
    } catch (error) {
      console.error('Error sending message to background script:', error);
    }
  }
}