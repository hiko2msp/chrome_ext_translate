// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  // For page translation
  chrome.contextMenus.create({
    id: 'en-to-ja',
    title: '英日翻訳（ページ全体）',
    contexts: ['page'],
  });
  chrome.contextMenus.create({
    id: 'ja-to-en',
    title: '日英翻訳（ページ全体）',
    contexts: ['page'],
  });

  // For selection translation
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '選択したテキストを翻訳',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'selection-to-ja',
    title: '→日本語へ',
    parentId: 'translate-selection',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'selection-to-en',
    title: '→英語へ',
    parentId: 'translate-selection',
    contexts: ['selection'],
  });
});

// Listener for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    console.error('Tab ID not found.');
    return;
  }

  const { menuItemId, selectionText } = info;

  // Handle page translation
  if (menuItemId === 'en-to-ja' || menuItemId === 'ja-to-en') {
    const sourceLang = menuItemId === 'en-to-ja' ? 'en' : 'ja';
    const targetLang = menuItemId === 'en-to-ja' ? 'ja' : 'en';

    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ['src/content.js'],
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error injecting script:', chrome.runtime.lastError);
          return;
        }
        chrome.tabs.sendMessage(tab.id!, {
          action: 'translatePage',
          sourceLang,
          targetLang,
        });
      }
    );
    return;
  }

  // Handle selection translation
  if (menuItemId === 'selection-to-ja' || menuItemId === 'selection-to-en') {
    if (!selectionText) return;

    const sourceLang = menuItemId === 'selection-to-ja' ? 'en' : 'ja'; // Assume source language
    const targetLang = menuItemId === 'selection-to-ja' ? 'ja' : 'en';

    // Open the side panel
    await chrome.sidePanel.open({ tabId: tab.id });

    try {
      const translatedText = await translateText(selectionText, sourceLang, targetLang);
      // Send the translation to the side panel
      chrome.runtime.sendMessage({
        action: 'showSelectionInSidePanel',
        text: translatedText,
      });
    } catch (error) {
      console.error('Selection translation error:', error);
      let errorMessage = 'An unknown error occurred.';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      // Send error to the side panel
      chrome.runtime.sendMessage({
        action: 'showSelectionInSidePanel',
        text: `Error: ${errorMessage}`,
      });
    }
  }
});


// Listener for messages from the content script (for page translation)
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request.text, request.sourceLang, request.targetLang)
      .then(translatedText => {
        sendResponse({ translatedText });
      })
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ error: error.message });
      });
    return true; // Indicates that the response is sent asynchronously
  }
});

// 型定義
interface PromptTemplate {
  beforeSystem: string;
  afterSystem: string;
  beforeUser: string;
  afterUser: string;
  beforeAssistant: string;
  afterAssistant: string;
}

// 返り値の型を付与
async function getPromptTemplate(
  sourceLang: string,
  targetLang: string
): Promise<PromptTemplate> {
  const fileName = `${sourceLang}2${targetLang}.preset.json`;
  const url = chrome.runtime.getURL(`templates/${fileName}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load prompt template: ${fileName}`);
  }
  const json = await response.json();

  // 型アサーションで期待する構造を明示
  return json.operation.fields[0].value.manualPromptTemplate as PromptTemplate;
}

async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const { endpoint, en2jaModel, ja2enModel } = await chrome.storage.local.get([
    'endpoint',
    'en2jaModel',
    'ja2enModel',
  ]);

  if (!endpoint) {
    throw new Error('LLM endpoint is not set.');
  }

  const model = sourceLang === 'en' && targetLang === 'ja' ? en2jaModel : ja2enModel;

  if (!model) {
    throw new Error(`Model for ${sourceLang} to ${targetLang} is not set.`);
  }

  const template = await getPromptTemplate(sourceLang, targetLang);

  const systemContent = `${template.beforeSystem}${template.afterSystem}
`;
  const userContent = `${template.beforeUser}${text}${template.afterUser}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model,
      prompt: systemContent + userContent,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const data = await response.json();
  let translated = data.choices[0].text as string;
  if (translated.startsWith(template.beforeAssistant)) {
    translated = translated.substring(template.beforeAssistant.length);
  }
  if (translated.endsWith(template.afterAssistant)) {
    translated = translated.substring(0, translated.length - template.afterAssistant.length);
  }
  return translated.trim();
}
