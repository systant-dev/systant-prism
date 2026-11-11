// The tuning of the glass a GlassBackdrop draws. The properties are registered
// with inherited defaults rather than set on the element, so they can be
// overridden on the element itself or once on any ancestor (a theme root, say).
export const refractionStyles = `
@property --prism-refraction {
  syntax: '<percentage>';
  inherits: true;
  initial-value: 20%;
}

@property --prism-refraction-width {
  syntax: '<length> | auto';
  inherits: true;
  initial-value: auto;
}

@property --prism-refraction-blur {
  syntax: '<length>';
  inherits: true;
  initial-value: 3px;
}

@property --prism-refraction-fade {
  syntax: '<time>';
  inherits: true;
  initial-value: 700ms;
}

/* The shape of one element's glass rather than a tuning of it, so glass inside a ring stays whole. */
@property --prism-refraction-hole {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

/* As the hole: glass inside a soft-edged ring keeps its own edges. */
@property --prism-refraction-soft {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}

/* As the hole: frost costs by its area, so only what asks for it pays. */
@property --prism-refraction-frost {
  syntax: '<length>';
  inherits: false;
  initial-value: 0px;
}
`
