// The properties lightSource.ts writes, and the light's reach. Everything lit by
// the light source renders this sheet: a card's border, an edge light.
//
// --prism-light-x/y/on change every frame the pointer moves, so they are
// registered as non-inherited: only the part that paints the light inherits them
// explicitly, and a change restyles the lit element and that part rather than
// everything inside it. --prism-light-on is a number so the light can fade in and
// out. The reach, --prism-card-highlight-size, is registered as a <length> so
// lightSource.ts reads it back in px whatever unit it was set in.
export const lightStyles = `
@property --prism-card-highlight-size {
  syntax: '<length>';
  inherits: true;
  initial-value: 280px;
}

@property --prism-light-x {
  syntax: '<length>';
  inherits: false;
  initial-value: -999px;
}

@property --prism-light-y {
  syntax: '<length>';
  inherits: false;
  initial-value: -999px;
}

@property --prism-light-on {
  syntax: '<number>';
  inherits: false;
  initial-value: 0;
}
`
