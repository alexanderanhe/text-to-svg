export const Label: React.FC<{ htmlFor?: string; children: React.ReactNode }>=({ htmlFor, children })=> (
  <label htmlFor={htmlFor} className="block text-left text-sm font-medium mb-1">{children}</label>
);

export const SquareDashedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40973 4.40973 4.71569 4.21799 5.09202C4 5.51984 4 6.07989 4 7.2V8M4 11V13M4 16V16.8C4 17.9201 4 18.4802 4.21799 18.908C4.40973 19.2843 4.71569 19.5903 5.09202 19.782C5.51984 20 6.07989 20 7.2 20H8M11 20H13M16 20H16.8C17.9201 20 18.4802 20 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V16M20 13V11M20 8V7.2C20 6.0799 20 5.51984 19.782 5.09202C19.5903 4.71569 19.2843 4.40973 18.908 4.21799C18.4802 4 17.9201 4 16.8 4H16M13 4H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TextIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3V21M9 21H15M19 6V3H5V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const PaintBrushIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.5 10.5L14.5 13.5M21.4999 6.49998L12.4688 15.5312C11.6403 16.3596 10.2972 16.3596 9.46875 15.5312C8.64032 14.7027 8.64032 13.3596 9.46875 12.5312L18.4999 3.49998C19.3283 2.67158 20.6714 2.67155 21.4999 3.49992C22.3284 4.32834 22.3284 5.67153 21.4999 6.49998ZM10.3398 17.75C10.3398 19.545 8.88477 21 7.08984 21H2.5L2.7103 20.8949C3.74629 20.3769 4.26276 19.1915 3.93667 18.08C3.87245 17.8612 3.83395 17.6335 3.85777 17.4067C4.02929 15.7732 5.41089 14.5 7.08984 14.5C8.88477 14.5 10.3398 15.9551 10.3398 17.75Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const PenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.4998 5.49994L18.3282 8.32837M3 20.9997L3.04745 20.6675C3.21536 19.4922 3.29932 18.9045 3.49029 18.3558C3.65975 17.8689 3.89124 17.4059 4.17906 16.9783C4.50341 16.4963 4.92319 16.0765 5.76274 15.237L17.4107 3.58896C18.1918 2.80791 19.4581 2.80791 20.2392 3.58896C21.0202 4.37001 21.0202 5.63634 20.2392 6.41739L8.37744 18.2791C7.61579 19.0408 7.23497 19.4216 6.8012 19.7244C6.41618 19.9932 6.00093 20.2159 5.56398 20.3879C5.07171 20.5817 4.54375 20.6882 3.48793 20.9012L3 20.9997Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ErraserIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 -5.5 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0)">
      <path d="M64.6808 116.306C54.3621 116.906 47.9051 115.666 37.5766 115.295C35.569 115.118 33.6705 114.306 32.1578 112.977C20.8328 101.882 12.1721 88.684 3.35796 75.6511C0.086417 70.8141 0.966322 66.871 5.53897 63.0287C24.265 47.2945 53.7472 21.7341 72.7077 5.91263C73.0965 5.58942 73.7503 5.08075 74.1644 4.78599C82.8593 -1.39109 85.4965 -1.2004 91.7888 7.13569C97.763 15.0535 103.361 23.2512 109.263 31.224C113.332 36.7185 117.628 42.0482 121.84 47.4379C122.788 48.6506 123.934 49.7243 124.771 51.0036C128.673 56.9686 128.076 61.1237 122.694 65.8147C111.849 75.2665 90.1359 94.7887 79.2988 104.25C77.94 105.433 68.3081 116.094 64.6808 116.306ZM114.803 60.5561C103.955 43.2699 92.0305 26.8285 81.4241 9.92746C69.8451 19.1065 49.5341 37.99 38.5434 46.7049L80.4372 91.163C88.4849 84.1469 107.154 67.2259 114.803 60.5561ZM70.7561 99.8844C57.3187 84.5645 46.2166 67.1897 31.1956 52.9195L11.2669 70.3435C17.8864 79.9898 23.6391 89.5599 30.5697 98.1882C40.4731 110.517 35.6885 107.826 51.5253 109.217C55.8841 109.601 62.8606 108.58 62.8606 108.58C62.8606 108.58 68.6288 103.95 70.7561 99.8844Z" fill="currentColor"/>
    </g>
    <defs>
      <clipPath id="clip0">
        <rect width="127" height="117" fill="white" transform="translate(0.777344)"/>
      </clipPath>
    </defs>
  </svg>
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 17H17.01M17.4 14H18C18.9319 14 19.3978 14 19.7654 14.1522C20.2554 14.3552 20.6448 14.7446 20.8478 15.2346C21 15.6022 21 16.0681 21 17C21 17.9319 21 18.3978 20.8478 18.7654C20.6448 19.2554 20.2554 19.6448 19.7654 19.8478C19.3978 20 18.9319 20 18 20H6C5.06812 20 4.60218 20 4.23463 19.8478C3.74458 19.6448 3.35523 19.2554 3.15224 18.7654C3 18.3978 3 17.9319 3 17C3 16.0681 3 15.6022 3.15224 15.2346C3.35523 14.7446 3.74458 14.3552 4.23463 14.1522C4.60218 14 5.06812 14 6 14H6.6M12 15V4M12 15L9 12M12 15L15 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const FlipBackwardsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8H16.5C18.9853 8 21 10.0147 21 12.5C21 14.9853 18.9853 17 16.5 17H3M3 8L6 5M3 8L6 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 6H20M16 6L15.7294 5.18807C15.4671 4.40125 15.3359 4.00784 15.0927 3.71698C14.8779 3.46013 14.6021 3.26132 14.2905 3.13878C13.9376 3 13.523 3 12.6936 3H11.3064C10.477 3 10.0624 3 9.70951 3.13878C9.39792 3.26132 9.12208 3.46013 8.90729 3.71698C8.66405 4.00784 8.53292 4.40125 8.27064 5.18807L8 6M18 6V16.2C18 17.8802 18 18.7202 17.673 19.362C17.3854 19.9265 16.9265 20.3854 16.362 20.673C15.7202 21 14.8802 21 13.2 21H10.8C9.11984 21 8.27976 21 7.63803 20.673C7.07354 20.3854 6.6146 19.9265 6.32698 19.362C6 18.7202 6 17.8802 6 16.2V6M14 10V17M10 10V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const NewIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 5C5.34315 5 4 6.34315 4 8V16C4 17.6569 5.34315 19 7 19H17C18.6569 19 20 17.6569 20 16V12.5C20 11.9477 20.4477 11.5 21 11.5C21.5523 11.5 22 11.9477 22 12.5V16C22 18.7614 19.7614 21 17 21H7C4.23858 21 2 18.7614 2 16V8C2 5.23858 4.23858 3 7 3H10.5C11.0523 3 11.5 3.44772 11.5 4C11.5 4.55228 11.0523 5 10.5 5H7Z" fill="currentColor"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M18.8431 3.58579C18.0621 2.80474 16.7957 2.80474 16.0147 3.58579L11.6806 7.91992L11.0148 11.9455C10.8917 12.6897 11.537 13.3342 12.281 13.21L16.3011 12.5394L20.6347 8.20582C21.4158 7.42477 21.4158 6.15844 20.6347 5.37739L18.8431 3.58579ZM13.1933 11.0302L13.5489 8.87995L17.4289 5L19.2205 6.7916L15.34 10.6721L13.1933 11.0302Z" fill="currentColor"/>
  </svg>
);

export const ImagePlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14.2647 15.9377L12.5473 14.2346C11.758 13.4519 11.3633 13.0605 10.9089 12.9137C10.5092 12.7845 10.079 12.7845 9.67922 12.9137C9.22485 13.0605 8.83017 13.4519 8.04082 14.2346L4.04193 18.2622M14.2647 15.9377L14.606 15.5991C15.412 14.7999 15.8149 14.4003 16.2773 14.2545C16.6839 14.1262 17.1208 14.1312 17.5244 14.2688C17.9832 14.4253 18.3769 14.834 19.1642 15.6515L20 16.5001M14.2647 15.9377L18.22 19.9628M18.22 19.9628C17.8703 20 17.4213 20 16.8 20H7.2C6.07989 20 5.51984 20 5.09202 19.782C4.7157 19.5903 4.40973 19.2843 4.21799 18.908C4.12583 18.7271 4.07264 18.5226 4.04193 18.2622M18.22 19.9628C18.5007 19.9329 18.7175 19.8791 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C20 18.4802 20 17.9201 20 16.8V13M11 4H7.2C6.07989 4 5.51984 4 5.09202 4.21799C4.7157 4.40973 4.40973 4.71569 4.21799 5.09202C4 5.51984 4 6.0799 4 7.2V16.8C4 17.4466 4 17.9066 4.04193 18.2622M18 9V6M18 6V3M18 6H21M18 6H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SortAmountDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 12H21M13 8H21M13 16H21M6 7V17M6 17L3 14M6 17L9 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SortAmountUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 12H21M13 8H21M13 16H21M6 7V17M6 7L3 10M6 7L9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const LayerDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 76 76" version="1.1" baseProfile="full" enableBackground="new 0 0 76.00 76.00">
    <path fill="currentColor" fillOpacity="1" strokeWidth="0.2" strokeLinejoin="round" d="M 26,22.0001L 27,21.9998L 27,27L 26.0001,27.0003C 23.2386,27.0003 21.0001,29.2389 21.0001,32.0003L 21,46.0002C 21,48.7616 23.2386,51.0002 25.9999,51.0002L 27,51.0002L 27,47L 33.75,53.5L 27,60L 27,56L 26,56C 20.4771,56 16,51.5229 16,46L 16,32.0001C 16,26.4773 20.4771,22.0001 26,22.0001 Z M 33,27L 59,27L 59,32L 33,32L 33,27 Z M 36,35L 59,35L 59,40L 36,40L 36,35 Z M 33,43L 59,43L 59,48L 33,48L 33,43 Z "/>
  </svg>
);

export const LayerUpIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 76 76" version="1.1" baseProfile="full" enableBackground="new 0 0 76.00 76.00">
    <path fill="currentColor" fillOpacity="1" strokeWidth="0.2" strokeLinejoin="round" d="M 33,31L 59,31L 59,36L 33,36L 33,31 Z M 36,39L 59,39L 59,44L 36,44L 36,39 Z M 33,47L 59,47L 59,52L 33,52L 33,47 Z M 23,44C 18.0294,44 14,39.9706 14,35C 14,30.0295 18.0294,26 23,26L 26,26L 26,22L 32.75,28.5L 26,35L 26,31L 23,31C 20.7909,31 19,32.7909 19,35C 19,37.2091 20.7909,39 23,39L 30,39L 30,44L 23,44 Z "/>
  </svg>
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 12H18M12 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const LayerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} width="800px" height="800px" viewBox="0 0 76.01 76.01" version="1.1" baseProfile="full" enableBackground="new 0 0 76.01 76.01">
    <path fill="currentColor" fillOpacity="1" strokeWidth="0.2" strokeLinejoin="round" d="M 57.0079,38.0053L 38.0053,47.5066L 19.0027,38.0053L 25.3369,34.8382L 38.0053,41.1724L 50.6737,34.8382L 57.0079,38.0053 Z M 38.0053,19.0027L 57.0079,28.504L 38.0053,38.0053L 19.0026,28.504L 38.0053,19.0027 Z M 57.0079,47.5066L 38.0053,57.008L 19.0026,47.5066L 25.3369,44.3395L 38.0053,50.6737L 50.6737,44.3395L 57.0079,47.5066 Z "/>
  </svg>
);