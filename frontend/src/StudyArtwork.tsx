import { StudentIllustration } from './StudentArt'
import { TaskArtwork } from './TaskVisual'

/** Shared 2D scene for authentication, library and empty states. */
export default function StudyArtwork({ className = '' }: { className?: string }) {
  return <div className={`study-illustration ${className}`} aria-hidden="true"><StudentIllustration pose="wave"/><TaskArtwork phase="idle"/></div>
}
