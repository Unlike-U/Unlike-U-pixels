import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const IconGitHub = (props: P) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.04.77 2.1 0 1.52-.01 2.74-.01 3.11 0 .3.2.66.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

export const IconBrush = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 20c0-2 1-3 3-3s3 1 3 3-1 2-3 2-3-.2-3-2Z" />
    <path d="M9.5 17.5 19 8a2.1 2.1 0 0 0-3-3l-9.5 9.5" />
    <path d="m14.5 6.5 3 3" />
  </svg>
);

export const IconGrid = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 15h18M9 4v16M15 4v16" />
  </svg>
);

export const IconClock = (props: P) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconBolt = (props: P) => (
  <svg {...base(props)}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const IconPlay = (props: P) => (
  <svg {...base(props)}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" />
  </svg>
);

export const IconPause = (props: P) => (
  <svg {...base(props)}>
    <path d="M8 4v16M16 4v16" strokeWidth={2.4} />
  </svg>
);

export const IconReset = (props: P) => (
  <svg {...base(props)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const IconCheck = (props: P) => (
  <svg {...base(props)}>
    <path d="m4 12.5 5 5L20 6.5" strokeWidth={2} />
  </svg>
);

export const IconWarn = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 9v5M12 17.2v.1" />
  </svg>
);

export const IconTerminal = (props: P) => (
  <svg {...base(props)}>
    <rect x="2.5" y="4" width="19" height="16" rx="2" />
    <path d="m7 9 3 3-3 3M13 15h4" />
  </svg>
);

export const IconImage = (props: P) => (
  <svg {...base(props)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 5-5 4 4 3-2 4 4" />
  </svg>
);

export const IconType = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 6V4h16v2M12 4v16M9 20h6" />
  </svg>
);

export const IconWand = (props: P) => (
  <svg {...base(props)}>
    <path d="m5 19 9-9M15 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
    <path d="m18 14 .7 1.4 1.4.6-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.6.7-1.4Z" />
  </svg>
);

export const IconLink = (props: P) => (
  <svg {...base(props)}>
    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
  </svg>
);

export const IconTrash = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </svg>
);

export const IconSave = (props: P) => (
  <svg {...base(props)}>
    <path d="M5 3h11l3 3v15H5V3Z" />
    <path d="M8 3v6h7V3M8 21v-6h8v6" />
  </svg>
);

export const IconDownload = (props: P) => (
  <svg {...base(props)}>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
  </svg>
);

export const IconSpinner = (props: P) => (
  <svg {...base(props)} className={`animate-spin ${props.className ?? ""}`}>
    <path d="M12 3a9 9 0 1 0 9 9" strokeWidth={2} />
  </svg>
);

export const IconArrowRight = (props: P) => (
  <svg {...base(props)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const IconLayers = (props: P) => (
  <svg {...base(props)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5M3 17.5l9 5 9-5" />
  </svg>
);
