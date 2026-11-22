import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }
type Kind = 'home' | 'materials' | 'ask' | 'cards' | 'quiz' | 'test' | 'profile' | 'book'
/** Original study symbols; vector geometry stays sharp at navigation sizes. */
function StudyIcon({ kind, size = 20, ...props }: IconProps & { kind: Kind }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    {kind === 'home' && <><path d="m3 10 9-7 9 7v10H3z"/><path d="M8 20v-7h8v7"/><path d="M10 8h4" opacity=".5"/></>}
    {kind === 'materials' && <><rect x="3" y="5" width="5" height="15" rx="1.5"/><rect x="8" y="3" width="5" height="17" rx="1.5"/><path d="m14 6 4-1 4 14-4 1zM5 9h1m4-2h1m5 3 3-1"/></>}
    {kind === 'ask' && <><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 2v.01"/></>}
    {kind === 'cards' && <><rect x="7" y="7" width="14" height="14" rx="3"/><path d="M17 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2m4-5h6m-6 4h4"/></>}
    {kind === 'quiz' && <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 9 1 1 2-3m3 2h2m-8 6 1 1 2-3m3 2h2"/></>}
    {kind === 'test' && <><path d="m2 8 10-5 10 5-10 5zM6 10v7q6 5 12 0v-7m4-2v8"/><path d="m10 17 1 1 3-3"/></>}
    {kind === 'profile' && <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2M9 20h6"/></>}
    {kind === 'book' && <><path d="M12 6Q7 2 2 5v15q5-3 10 1 5-4 10-1V5q-5-3-10 1Zm0 0v15M6 8l3 1m-3 3 3 1m6-4 3-1m-3 5 3-1"/></>}
  </svg>
}
export const HomeIcon = (props: IconProps) => <StudyIcon kind="home" {...props}/>
export const MaterialsIcon = (props: IconProps) => <StudyIcon kind="materials" {...props}/>
export const AskIcon = (props: IconProps) => <StudyIcon kind="ask" {...props}/>
export const CardsIcon = (props: IconProps) => <StudyIcon kind="cards" {...props}/>
export const QuizIcon = (props: IconProps) => <StudyIcon kind="quiz" {...props}/>
export const TestIcon = (props: IconProps) => <StudyIcon kind="test" {...props}/>
export const ProfileIcon = (props: IconProps) => <StudyIcon kind="profile" {...props}/>
export const StudyBookIcon = (props: IconProps) => <StudyIcon kind="book" {...props}/>
