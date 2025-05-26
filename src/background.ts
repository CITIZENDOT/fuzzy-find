// src/background.ts

// This map will store the tabId associated with each active popup connection.
// This is crucial because when onDisconnect fires, you'll need to know which tab
// the popup was associated with to clear highlights on the correct tab.
const popupTabMap = new Map<chrome.runtime.Port, number>()

chrome.runtime.onConnect.addListener(function (port) {
  console.log('onConnect', port.name)

  if (port.name === 'popup') {
    // When popup connects, store its tabId.
    // `port.sender.tab.id` is available here during onConnect.
    const tabId = port.sender?.tab?.id
    if (tabId !== undefined) {
      popupTabMap.set(port, tabId)
      console.log(`Popup connected from tab: ${tabId}`)
    }

    port.onDisconnect.addListener(function () {
      // Retrieve the tabId associated with this disconnected port.
      const disconnectedTabId = popupTabMap.get(port)
      popupTabMap.delete(port) // Clean up the map

      console.log(`Popup has been closed. Sending CLEAR_HIGHLIGHTS to tab: ${disconnectedTabId}`)

      if (disconnectedTabId !== undefined) {
        // Send the CLEAR_HIGHLIGHTS message to the content script of the tab
        // that the popup was active on.
        chrome.tabs
          .sendMessage(disconnectedTabId, { type: 'CLEAR_HIGHLIGHTS' })
          .catch(e =>
            console.warn(`Error sending CLEAR_HIGHLIGHTS to tab ${disconnectedTabId}:`, e)
          )
      }
    })
  }
})

// You'd also handle other background script logic here, e.g., if you had
// more complex search features involving multiple tabs or history.
// For example, if you had a 'fuzzySearch' action from previous discussion:
/*
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fuzzySearch') {
    // ... handle fuzzy search across tabs/history ...
    // Note: If popup was using `sendMessage` to background for *search*,
    // this listener would catch it. For this "Find on Page" feature,
    // the popup often sends directly to content script.
  }
});
*/
