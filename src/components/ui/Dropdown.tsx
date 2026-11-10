import { useEffect, useRef, useState } from 'react'

export interface DropdownItem {
  id: string
  label: string
  onClick: () => void
  disabled?: boolean
}

export interface DropdownSection {
  items: DropdownItem[]
}

interface DropdownProps {
  label: string
  icon?: React.ReactNode
  sections: DropdownSection[]
  buttonClassName?: string
  buttonDataAttrs?: Record<string, string>
}

export function Dropdown({
  label,
  icon,
  sections,
  buttonClassName = 'bg-butter-300 text-ink hover:bg-butter-400',
  buttonDataAttrs = {},
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [open])

  const handleItemClick = (item: DropdownItem) => {
    item.onClick()
    setOpen(false)
  }

  const allItems = sections.flatMap((s) => s.items).length
  const hasNoItems = allItems === 0

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        disabled={hasNoItems}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`rounded-soft px-3 py-2 font-medium transition ${buttonClassName} ${hasNoItems ? 'opacity-50 cursor-not-allowed' : ''}`}
        {...buttonDataAttrs}
      >
        {icon || '⋮'}
      </button>

      {open && !hasNoItems && (
        <div className="absolute right-0 mt-1 w-48 origin-top-right rounded-soft border border-line bg-paper shadow-soft z-50">
          {sections.map((section, secIdx) => (
            <div key={secIdx}>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleItemClick(item)}
                  className={`block w-full px-4 py-2 text-left text-sm transition first:rounded-t-soft last:rounded-b-soft ${
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed text-line'
                      : 'text-ink hover:bg-cream-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {secIdx < sections.length - 1 && (
                <div className="h-px bg-line" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
