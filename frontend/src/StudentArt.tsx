import type { CompanionState } from './Companion'

export type StudentPose = 'idle' | 'wave' | 'point' | 'think' | 'read' | 'upload' | 'success' | 'error'
const activityPose: Record<CompanionState, StudentPose> = { idle: 'idle', uploading: 'upload', processing: 'think', ready: 'success', studying: 'read', success: 'success', error: 'error' }

/** Original vector artwork. No third-party character assets or runtime requests. */
export function StudentIllustration({ state = 'idle', pose, avatar = 'sage' }: { state?: CompanionState; pose?: StudentPose; avatar?: string }) {
  const expression = pose || activityPose[state]
  const leftSleeve = expression === 'wave' ? 'M56 88Q36 89 28 70' : expression === 'read' ? 'M56 87Q42 101 51 114' : 'M56 85Q40 94 43 113'
  const leftHand = expression === 'wave' ? 'M28 70 19 52' : expression === 'read' ? 'M51 114 67 123' : 'M43 113 51 126'
  const rightSleeve = expression === 'point' ? 'M104 87Q119 87 129 89' : expression === 'think' ? 'M104 87Q121 97 112 109' : ['upload', 'success'].includes(expression) ? 'M104 87Q119 82 122 69' : expression === 'read' ? 'M104 87Q119 101 109 114' : expression === 'error' ? 'M104 87Q116 94 125 107' : 'M104 85Q120 94 117 113'
  const rightHand = expression === 'point' ? 'M129 89h16' : expression === 'think' ? 'M112 109 99 91 94 79' : ['upload', 'success'].includes(expression) ? 'M122 69 128 55' : expression === 'read' ? 'M109 114 94 123' : expression === 'error' ? 'M125 107 139 100' : 'M117 113 109 126'
  return <svg className={`student-illustration student-guide-2d pose-${expression} avatar-${avatar}`} data-pose={expression} viewBox="0 0 160 180" aria-hidden="true" focusable="false">
    <ellipse cx="80" cy="170" rx="46" ry="6" fill="currentColor" opacity=".08"/>
    <g className="student-body">
      <g className="leg-left"><path d="M58 123h24l-5 38H58z" fill="#243d4c"/><path d="M57 157h21v12H49q-4-9 8-12" fill="#20313f"/><path d="M49 168h30" stroke="#f7f7ef" strokeWidth="3"/></g>
      <g className="leg-right"><path d="M81 123h23l5 38H88z" fill="#355163"/><path d="M88 157h21q13 6 8 12H88z" fill="#20313f"/><path d="M88 168h30" stroke="#f7f7ef" strokeWidth="3"/></g>
      <path d="M55 83q25-15 50 0l8 46q-31 14-65 0z" className="student-shirt"/>
      <path d="M68 79q12 16 24 0" fill="none" stroke="#edf2ff" strokeWidth="6"/>
      <path d="M73 77v12q8 7 15-1V75" fill="#e8b88d"/>
      <path d="M80 92v35" stroke="#edf2ff" strokeWidth="3"/>
      <path d="M94 98h8v10h-8z" fill="#a8b9ff"/>
      <g className="arm-left"><path d={leftSleeve} fill="none" stroke="var(--shirt)" strokeWidth="17" strokeLinecap="round"/><path d={leftHand} fill="none" stroke="#edc29b" strokeWidth="12" strokeLinecap="round"/>
        {expression === 'wave' && <g className="waving-hand"><ellipse cx="18" cy="47" rx="7" ry="9" fill="#edc29b"/><path d="M12 44 9 36m7 6-1-11m6 11 1-11m3 14 4-9" fill="none" stroke="#edc29b" strokeWidth="4" strokeLinecap="round"/></g>}
      </g>
      <g className="arm-right"><path d={rightSleeve} fill="none" stroke="var(--shirt)" strokeWidth="17" strokeLinecap="round"/><path d={rightHand} fill="none" stroke="#edc29b" strokeWidth="12" strokeLinecap="round"/>
        {expression === 'point' && <path d="M143 86h12m-12 4h6" stroke="#edc29b" strokeWidth="5" strokeLinecap="round"/>}
        {expression === 'success' && <path d="M123 58V47q0-5 4-5 3 0 3 5v4h8q5 0 4 5l-3 9h-12z" fill="#edc29b"/>}
        {expression === 'error' && <g fill="#edc29b"><ellipse cx="141" cy="99" rx="9" ry="4"/><path d="m137 99-3-8 4-1 5 9z"/></g>}
      </g>
      <g className="student-head"><path d="M45 48q-3-38 34-38 40 0 39 39l-8 25-58-2z" fill="var(--hair, #213a4c)"/>
        <ellipse cx="50" cy="59" rx="6" ry="9" fill="#edc29b"/><ellipse cx="111" cy="59" rx="6" ry="9" fill="#edc29b"/>
        <path d="M51 44q29 3 40-16 2 13 18 18v20q-1 25-28 26-28-3-30-28z" fill="#f0c6a1"/>
        <path d="M49 47q-1-30 31-31 29 1 31 25-13-3-17-17-10 24-45 23" fill="var(--hair, #213a4c)"/>
        <g className="student-eyes"><ellipse cx="68" cy="60" rx="3" ry="4" fill="var(--hair, #213a4c)"/><ellipse cx="95" cy="60" rx="3" ry="4" fill="var(--hair, #213a4c)"/></g>
        <path d={expression === 'error' ? 'M76 77q6-6 12 0' : expression === 'think' ? 'M77 76h9' : 'M76 73q6 6 12 0'} fill="none" stroke="#9a5f4f" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M57 57q9-7 20 0v10H58zm29 0q11-7 20 0v10H87zM77 60h9" fill="none" stroke="#355163" strokeWidth="2"/>
        <ellipse cx="60" cy="73" rx="5" ry="2.5" fill="#d68a77" opacity=".4"/><ellipse cx="103" cy="73" rx="5" ry="2.5" fill="#d68a77" opacity=".4"/>
      </g>
      {expression === 'read' ? <g className="reading-book"><path d="M80 115q-14-9-30-4v30q15-4 30 4 15-8 30-4v-30q-16-5-30 4z" fill="#fffdf7" stroke="#3155d9" strokeWidth="2.5"/><path d="M80 115v30m-23-27 16 3m-16 4 16 3m14-7 16-3m-16 10 16-3" stroke="#8295c7" strokeWidth="1.8"/></g>
        : expression === 'idle' && <g className="student-book"><path d="M47 108l31-4 8 34-31 4z" fill="#fffdf7" stroke="#8c9dc7" strokeWidth="2"/><path d="M53 112l23-3m-20 10 18-3m-16 10 18-3" stroke="#8295c7" strokeWidth="2"/></g>}
      {expression === 'upload' && <g className="uploading-page"><path d="M111 38h25l9 9v39h-34z" fill="#fffdf7" stroke="#3155d9" strokeWidth="2"/><path d="M136 38v10h9m-17 27V55m-7 7 7-7 7 7" fill="none" stroke="#3155d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></g>}
      {expression === 'think' && <path d="M91 79h7" stroke="#edc29b" strokeWidth="7" strokeLinecap="round"/>}
    </g>
    {expression === 'success' && <g className="student-reaction"><circle cx="133" cy="27" r="14" fill="#247553"/><path d="m126 27 5 5 9-10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"/></g>}
    {expression === 'error' && <g className="student-reaction"><circle cx="133" cy="27" r="14" fill="#a74747"/><path d="M133 19v9m0 5v2" stroke="white" strokeWidth="3" strokeLinecap="round"/></g>}
    {expression === 'think' && <g className="thought-dots" fill="#8295c7"><circle cx="126" cy="40" r="3"/><circle cx="137" cy="30" r="4"/><circle cx="146" cy="16" r="5"/></g>}
  </svg>
}
