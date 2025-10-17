chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
  if (request.action === 'translatePage') {
    translatePage(request.sourceLang, request.targetLang);
  }
});

const skipTags = new Set(['STYLE', 'SCRIPT', 'NOSCRIPT', 'CODE', 'PRE']);

async function translatePage(sourceLang: string, targetLang: string) {
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

  for (const node of textNodes) {
    const text = node.nodeValue!;
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        sourceLang,
        targetLang,
      });
      console.log('Translated ', text, response);

      if (response.translatedText) {
        console.log('Translated text:', text, response.translatedText);
        node.nodeValue = response.translatedText;
      } else if (response.error) {
        console.error('Translation failed:', response.error);
      }
    } catch (error) {
      console.error('Error sending message to background script:', error);
    }
  }
}
