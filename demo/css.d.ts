// Lets the demo set custom properties in a style prop without a cast.
declare module 'react' {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined
  }
}

export {}
