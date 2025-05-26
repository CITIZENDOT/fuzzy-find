// src/App.tsx
import { useCallback, useEffect, useState } from 'react'
// Assuming you've set up ShadCN, import components:
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'

function App() {
  const [query, setQuery] = useState('')
  const [totalResults, setTotalResults] = useState(0)
  const [activeResultIndex, setActiveResultIndex] = useState(-1)
  const [useRegex, setUseRegex] = useState(false)
  const [hasSearched, setHasSearched] = useState(false) // Track if a search has been performed
  const [_backgroundPort, setBackgroundPort] = useState<chrome.runtime.Port | null>(null)
  const [fuseThreshold, setFuseThreshold] = useState<number[]>([0.4])

  const resetSearch = useCallback((emptyQuery: boolean = false) => {
    if (emptyQuery) {
      setQuery('')
    }
    setTotalResults(0)
    setActiveResultIndex(-1)
    setHasSearched(false)

    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      const tabId = tabs[0]?.id
      if (tabId !== undefined) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_HIGHLIGHTS' })
        } catch (error) {
          console.error('Error clearing highlights:', error)
        }
      }
    })
  }, [])

  // Function to send search request to content script
  const sendSearchRequest = useCallback(
    async (q: string, regexMode: boolean, threshold: number) => {
      // Clear highlights if query is empty or just whitespace
      if (!q.trim()) {
        resetSearch(false)
        return
      }

      setHasSearched(true) // A search attempt is being made

      chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
        const tabId = tabs[0]?.id
        if (tabId !== undefined) {
          // Ensure content script is injected and ready before sending message
          await chrome.scripting
            .executeScript({
              target: { tabId: tabId },
              files: ['content.js'], // Path to your compiled content script
            })
            .catch(e => console.warn('Could not inject content script:', e)) // Catch errors on restricted pages

          try {
            const response = await chrome.tabs.sendMessage(tabId, {
              type: 'HIGHLIGHT_TEXT',
              query: q,
              isRegex: regexMode,
              threshold: threshold,
            })
            if (response && response.type === 'SEARCH_RESULTS') {
              setTotalResults(response.total)
              setActiveResultIndex(response.activeIndex)
            }
          } catch (error) {
            console.error('Error sending message to content script:', error)
            setTotalResults(0) // Assume no results or error
            setActiveResultIndex(-1)
            // Potentially display an error message to the user
          }
        }
      })
    },
    [resetSearch]
  )

  // Debounce the search input to avoid excessive messages
  useEffect(() => {
    const handler = setTimeout(() => {
      sendSearchRequest(query, useRegex, fuseThreshold[0])
    }, 300) // Adjust debounce time (e.g., 300ms)

    return () => {
      clearTimeout(handler)
    }
  }, [query, fuseThreshold, useRegex, sendSearchRequest]) // Re-run effect when query or useRegex changes

  // Handle keyboard navigation (Enter for next, Shift+Enter for previous)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && totalResults > 0) {
      e.preventDefault() // Prevent default form submission or new line in input
      chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
        const tabId = tabs[0]?.id
        if (tabId !== undefined) {
          const messageType = e.shiftKey ? 'NAVIGATE_PREVIOUS' : 'NAVIGATE_NEXT'
          try {
            const response = await chrome.tabs.sendMessage(tabId, { type: messageType })
            if (response && response.type === 'SEARCH_RESULTS') {
              setTotalResults(response.total)
              setActiveResultIndex(response.activeIndex)
            }
          } catch (error) {
            console.error('Error sending navigation message:', error)
          }
        }
      })
    } else if (e.key === 'Escape') {
      resetSearch(true)
    }
  }

  // Ensure content script is always running when popup opens
  // You could also add logic to re-send the last query to re-highlight
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'popup' })
    setBackgroundPort(port)

    const onDisconnect = () => {
      console.log('Background port disconnected.')
      setBackgroundPort(null)
    }

    port.onDisconnect.addListener(onDisconnect)

    // Re-send the last query if one exists, to re-highlight the page
    // This is important if the user closes and re-opens the popup
    // while the page is still active.
    if (query.trim()) {
      sendSearchRequest(query, useRegex, fuseThreshold[0])
    }

    return () => {
      console.log('Popup component unmounting. Disconnecting from background port.')
      if (port) {
        // Explicitly disconnect the port. This will trigger onDisconnect in background.
        port.disconnect()
        port.onDisconnect.removeListener(onDisconnect)
      }
      setBackgroundPort(null)
    }
  }, []) // Run once on mount

  return (
    <div className="w-[320px] p-4 font-sans text-gray-800">
      {' '}
      {/* Added width for consistent popup size */}
      <h1 className="mb-3 text-center text-xl font-semibold">Fuzzy Find</h1>
      <div className="mb-3 flex flex-col gap-2">
        <Input
          type="text"
          placeholder="Find text..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full"
          autoFocus // Focus input when popup opens
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch id="regex-toggle" checked={useRegex} onCheckedChange={setUseRegex} />
            <Label htmlFor="regex-toggle">Regex Mode</Label>
          </div>
          <div className="text-sm text-gray-600">
            {
              hasSearched
                ? totalResults > 0
                  ? `${activeResultIndex + 1} of ${totalResults}`
                  : query.length > 0
                    ? 'No results'
                    : ''
                : '' // Before any search, show nothing
            }
          </div>
        </div>
      </div>
      {!useRegex && (
        <div className="mt-2 mb-2 flex items-center space-x-2">
          <Label htmlFor="fuse-threshold" className="shrink-0 text-xs">
            Fuzziness
          </Label>
          <Slider
            id="fuse-threshold"
            min={0.0}
            max={1.0}
            step={0.05}
            value={fuseThreshold}
            onValueChange={setFuseThreshold}
            className="w-full"
          />
          <span className="w-10 text-right text-xs text-gray-500">
            {fuseThreshold[0].toFixed(2)}
          </span>
        </div>
      )}
      <div className="flex justify-between space-x-2">
        <Button
          onClick={() => {
            chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
              const tabId = tabs[0]?.id
              if (tabId !== undefined) {
                try {
                  const response = await chrome.tabs.sendMessage(tabId, {
                    type: 'NAVIGATE_PREVIOUS',
                  })
                  if (response && response.type === 'SEARCH_RESULTS') {
                    setTotalResults(response.total)
                    setActiveResultIndex(response.activeIndex)
                  }
                } catch (error) {
                  console.error('Error navigating previous:', error)
                }
              }
            })
          }}
          disabled={totalResults <= 1} // Disable if 0 or 1 result
          className="flex-1"
        >
          Previous
        </Button>
        <Button
          onClick={() => {
            chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
              const tabId = tabs[0]?.id
              if (tabId !== undefined) {
                try {
                  const response = await chrome.tabs.sendMessage(tabId, { type: 'NAVIGATE_NEXT' })
                  if (response && response.type === 'SEARCH_RESULTS') {
                    setTotalResults(response.total)
                    setActiveResultIndex(response.activeIndex)
                  }
                } catch (error) {
                  console.error('Error navigating next:', error)
                }
              }
            })
          }}
          disabled={totalResults <= 1} // Disable if 0 or 1 result
          className="flex-1"
        >
          Next
        </Button>
      </div>
      <div className="mt-2 flex w-full items-center justify-center">
        <p>
          Built by{' '}
          <a
            href="https://citizendot.github.io"
            target="_blank"
            className="text-blue-500 underline-offset-3 hover:underline"
          >
            Appaji
          </a>
        </p>
      </div>
    </div>
  )
}

export default App
