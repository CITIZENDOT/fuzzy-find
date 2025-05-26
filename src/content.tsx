import Fuse from 'fuse.js'
import './styles/content.css'

const HIGHLIGHT_CLASS = 'found-item'
const ACTIVE_HIGHLIGHT_CLASS = 'found-item-active'

// Global variables to manage matches
let allMarks: HTMLElement[] = [] // Stores all <mark> elements created
let activeMatchIndex: number = -1 // Index of the currently active match
let highlightContainers: HTMLSpanElement[] = [] // Track temporary containers

/**
 * Clears all previously applied highlights from the page.
 * Reverts the temporary highlight containers back to plain text nodes.
 */
function clearHighlights() {
  if (activeMatchIndex !== -1 && allMarks[activeMatchIndex]) {
    allMarks[activeMatchIndex].classList.remove(ACTIVE_HIGHLIGHT_CLASS)
  }

  highlightContainers.forEach(container => {
    if (container.parentNode) {
      const originalText = document.createTextNode(container.textContent || '')
      container.parentNode.replaceChild(originalText, container)
    }
  })

  allMarks = []
  highlightContainers = []
  activeMatchIndex = -1

  document.body.normalize() // Crucial: merges adjacent text nodes back together
}

/**
 * Updates the CSS classes for all highlights to reflect the active match.
 * Scrolls the active match into view.
 */
function updateActiveHighlight() {
  if (allMarks.length === 0) return

  allMarks.forEach((mark, index) => {
    if (index === activeMatchIndex) {
      mark.classList.add(ACTIVE_HIGHLIGHT_CLASS)
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      mark.classList.remove(ACTIVE_HIGHLIGHT_CLASS)
    }
  })
}

/**
 * Helper function to apply <mark> tags based on a list of character index ranges.
 * This function also merges overlapping or adjacent ranges to create single marks.
 *
 * @param text The original text string.
 * @param indices An array of [start, end] tuples representing character ranges to highlight.
 * @param className The CSS class to apply to the <mark> tags.
 * @returns An HTML string with <mark> tags applied.
 */
function applyHighlightsByIndices(
  text: string,
  indices: [number, number][],
  className: string
): string {
  let result = ''
  let lastIndex = 0

  indices.sort((a, b) => a[0] - b[0])

  const mergedIndices: [number, number][] = []
  if (indices.length > 0) {
    mergedIndices.push([...indices[0]])
    for (let i = 1; i < indices.length; i++) {
      const current = indices[i]
      const lastMerged = mergedIndices[mergedIndices.length - 1]
      // If current range overlaps or is adjacent (start <= end of last merged)
      if (current[0] <= lastMerged[1]) {
        lastMerged[1] = Math.max(lastMerged[1], current[1])
      } else {
        mergedIndices.push([...current])
      }
    }
  }

  mergedIndices.forEach(([start, end]) => {
    result += text.substring(lastIndex, start)

    const markElement = document.createElement('mark')
    markElement.className = className
    markElement.textContent = text.substring(start, end)
    result += markElement.outerHTML

    lastIndex = end
  })

  result += text.substring(lastIndex)
  return result
}

/**
 * Finds all words and their character ranges within a given string.
 * A "word" is defined by \b\w+\b (word boundaries and alphanumeric characters).
 *
 * @param text The string to analyze.
 * @returns An array of objects, each containing the word string, its start index, and end index.
 */
function findWordBoundaries(text: string): { word: string; start: number; end: number }[] {
  const words: { word: string; start: number; end: number }[] = []
  const wordRegex = /\b\w+\b/g // Matches whole words (alphanumeric characters, includes numbers)
  let match
  while ((match = wordRegex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return words
}

/**
 * Highlights all occurrences of a query string or regex pattern on the page.
 *
 * @param query The search string.
 * @param isRegex If true, query is treated as a regular expression.
 * @param fuseThreshold The threshold for fuzzy searching (0.0 to 1.0).
 * @returns An object containing the total number of matches and the active index.
 */
function highlightText(
  query: string,
  isRegex: boolean = false,
  fuseThreshold: number = 0.4
): { total: number; activeIndex: number } {
  clearHighlights()
  if (!query) {
    return { total: 0, activeIndex: -1 }
  }

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const searchPattern = isRegex ? query : escapeRegex(query)
  let regex: RegExp
  try {
    regex = new RegExp(searchPattern, 'gi')
  } catch (e) {
    console.error('Invalid regex pattern:', e)
    return { total: 0, activeIndex: -1 }
  }

  const filter = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const parentNodeName = node.parentNode?.nodeName
      if (
        parentNodeName === 'SCRIPT' ||
        parentNodeName === 'STYLE' ||
        parentNodeName === 'NOSCRIPT' ||
        parentNodeName === 'META' ||
        parentNodeName === 'TITLE' ||
        parentNodeName === 'LINK' ||
        parentNodeName === 'HEAD' ||
        (node.parentNode instanceof HTMLElement &&
          node.parentNode.dataset.extensionHighlightContainer === 'true') ||
        (node.parentNode instanceof HTMLElement && node.parentNode.hidden)
      ) {
        return NodeFilter.FILTER_SKIP
      }
      if (node.nodeValue?.trim() === '') {
        return NodeFilter.FILTER_SKIP
      }
      return NodeFilter.FILTER_ACCEPT
    }
    return NodeFilter.FILTER_SKIP
  }

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    filter as NodeFilter
  )

  const nodesToProcess: Text[] = []
  let textNode: Text | null
  while ((textNode = walker.nextNode() as Text | null)) {
    nodesToProcess.push(textNode)
  }

  nodesToProcess.forEach(node => {
    const textContent = node.nodeValue || ''
    const parent = node.parentNode

    if (!parent) return

    let modifiedContent = textContent
    const highlightRangesForNode: [number, number][] = [] // Collect ranges for this specific text node

    if (isRegex) {
      let match
      while ((match = regex.exec(textContent)) !== null) {
        highlightRangesForNode.push([match.index, match.index + match[0].length])
      }
      if (highlightRangesForNode.length > 0) {
        modifiedContent = applyHighlightsByIndices(
          textContent,
          highlightRangesForNode,
          HIGHLIGHT_CLASS
        )
      }
    } else {
      // FUZZY SEARCH LOGIC WITH FUSE.JS (Modified for whole word highlighting)
      const wordsInNode = findWordBoundaries(textContent) // Get all words in this text node

      // Fuse.js needs to search within an array of objects for 'keys'
      const fuse = new Fuse(wordsInNode, {
        keys: ['word'], // Search within the 'word' property of each object
        includeMatches: true, // Get indices of matched characters within the word
        findAllMatches: true, // Get all fuzzy matches within the word
        threshold: fuseThreshold, // Use the dynamic threshold from the popup
        ignoreLocation: true,
        distance: 100,
      })

      const fuseResults = fuse.search(query)
      const wordsToHighlightIndices: Set<[number, number]> = new Set() // Use a Set to store unique word ranges

      // Iterate over Fuse.js results that are full words
      fuseResults.forEach(result => {
        // result.item is the { word, start, end } object from wordsInNode
        // result.matches contains the character-level matches within 'result.item.word'
        // We want to highlight the *entire* result.item.word (its start/end in the textContent)
        wordsToHighlightIndices.add([result.item.start, result.item.end])
      })

      if (wordsToHighlightIndices.size > 0) {
        // Convert Set to Array and apply highlights
        modifiedContent = applyHighlightsByIndices(
          textContent,
          Array.from(wordsToHighlightIndices),
          HIGHLIGHT_CLASS
        )
      }
    }

    if (modifiedContent !== textContent) {
      const container = document.createElement('span')
      container.dataset.extensionHighlightContainer = 'true'
      container.style.display = 'contents'
      container.innerHTML = modifiedContent

      parent.replaceChild(container, node)
      highlightContainers.push(container)

      container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`).forEach(mark => {
        allMarks.push(mark as HTMLElement)
      })
    }
  })

  if (allMarks.length > 0) {
    activeMatchIndex = 0
    updateActiveHighlight()
  }

  return { total: allMarks.length, activeIndex: activeMatchIndex }
}

/**
 * Navigates to the next or previous match.
 *
 * @param direction 'next' or 'prev'.
 * @returns An object containing the updated total matches and active index.
 */
function navigateMatches(direction: 'next' | 'prev'): { total: number; activeIndex: number } {
  if (allMarks.length === 0) {
    activeMatchIndex = -1 // Ensure reset if no matches
    return { total: 0, activeIndex: -1 }
  }

  // Remove the active class from the current active match
  if (activeMatchIndex !== -1) {
    allMarks[activeMatchIndex].classList.remove(ACTIVE_HIGHLIGHT_CLASS)
  }

  if (direction === 'next') {
    activeMatchIndex = (activeMatchIndex + 1) % allMarks.length
  } else {
    // 'prev'
    activeMatchIndex = (allMarks.length + activeMatchIndex - 1) % allMarks.length
  }

  updateActiveHighlight() // Apply new active class and scroll
  return { total: allMarks.length, activeIndex: activeMatchIndex }
}

// Listen for messages from the extension's popup script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'HIGHLIGHT_TEXT') {
    const { total, activeIndex } = highlightText(message.query, message.isRegex, message.threshold)
    sendResponse({ type: 'SEARCH_RESULTS', total, activeIndex })
  } else if (message.type === 'NAVIGATE_NEXT') {
    const { total, activeIndex } = navigateMatches('next')
    sendResponse({ type: 'SEARCH_RESULTS', total, activeIndex })
  } else if (message.type === 'NAVIGATE_PREVIOUS') {
    const { total, activeIndex } = navigateMatches('prev')
    sendResponse({ type: 'SEARCH_RESULTS', total, activeIndex })
  } else if (message.type === 'CLEAR_HIGHLIGHTS') {
    clearHighlights()
    sendResponse({ type: 'SEARCH_RESULTS', total: 0, activeIndex: -1 })
  }
})
