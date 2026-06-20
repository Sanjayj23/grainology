// CSS module type declarations for Next.js
declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}

// Allow importing CSS as side-effect
declare module '*globals.css';
declare module '*/globals.css';
