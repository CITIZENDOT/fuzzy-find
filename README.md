# Fuzzy Find

This Chrome extension helps you to fuzzy search in the web page. Meaning, it can find the text you are looking for even if you don't know the exact spelling. Also supports regex search.

Here's the demo of me trying to search for "encyclopedia", but typing "ecyclopedia". Matches include "encyclopedia", "encyclopedias".

https://github.com/user-attachments/assets/c621b90d-bf7b-4421-9cbd-b22684372e63

## How to Install

Add the extension from the Chrome webstore: https://chromewebstore.google.com/detail/fuzzy-find/nafgnfmmicbilnbccpbophlegklgoaci

## ✨ Features

Fuzzy Find goes beyond basic string matching to provide a more intuitive and powerful search experience:

- **Intelligent Fuzzy Search:** Find matches even with typos, misspellings, or slight variations. Eg: Searching for "recive" will highlight "receive".

- **Whole Word Highlighting:** Unlike some fuzzy search tools that highlight only the matched characters, Fuzzy Find intelligently highlights the entire word that contains your fuzzy match, making results clear and easy to spot.

- **Adjustable Fuzziness:** You can control the fuzziness level through the slider in the Popup.

- **Regex Search:** Just toggle the Regex switch. (This would disable fuzzy search).

## 💡 Usage

- Either click the extension icon in the browser toolbar or use the shortcut <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> (or <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> on Mac) to open the search popup.

## Known Issues

- Some text is not visible for various reasons such as: display is set to none (or) It's in the DOM but is present in a Modal that is conditionally open, it's color is set to `transparent` etc.. Those text are also counted towards the total matches. and tried to be highlighted.
- If query has spaces, Fuzzy search results will be unexpected. Although, regex search will work as expected.

If you find any other issues, please report them in the [issues](https://github.com/CITIZENDOT/fuzzy-find/issues) section.
