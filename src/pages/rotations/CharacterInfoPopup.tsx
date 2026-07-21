import { useEffect, useId, useRef } from 'react'
import { InfoIcon } from '../../components/icons'
import { CharacterKitView } from '../characters/CharacterKitView'
import type { CharacterData } from './types'

interface CharacterInfoPopupProps {
  character: CharacterData
  onClose: () => void
}

export function CharacterInfoPopup({
  character,
  onClose,
}: CharacterInfoPopupProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()

    function onCancel(e: Event) {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="rotation-char-info-dialog"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
    >
      <div className="rotation-char-info">
        <button
          type="button"
          className="chip compact rotation-char-info-close"
          onClick={onClose}
          autoFocus
        >
          Close
        </button>
        <CharacterKitView character={character} headingId={titleId} />
      </div>
    </dialog>
  )
}

interface CharacterInfoButtonProps {
  character: CharacterData
  onOpen: (character: CharacterData) => void
}

export function CharacterInfoButton({
  character,
  onOpen,
}: CharacterInfoButtonProps) {
  return (
    <button
      type="button"
      className="rotation-char-info-btn"
      aria-label={`Info for ${character.name}`}
      title={`Kit info · ${character.name}`}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onOpen(character)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      draggable={false}
    >
      <InfoIcon />
    </button>
  )
}
