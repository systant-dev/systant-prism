// How a tree bends. A trunk, and a branch on it, are beams fixed at one end, and a
// beam like that can't bend any way it likes: Euler and Bernoulli's equation for it
// allows only certain shapes, each at its own frequency, and everything it does is some
// of each. So how far any point moves depends on how far along the beam it is.
//
// A trunk isn't the beam of even thickness in the textbooks. It tapers to a fraction of
// its width at the top, and stiffness goes as the fourth power of width, and it carries
// the weight of its crown up there too. So nearly all its bending is near the top: three
// quarters of the way up moves less than half as far as the top, and half way up hardly
// moves. The second shape has a point near the top that stays still, with what's above it
// moving against what's below, which is the whip at the very top of a tree in a gust.
//
// The shapes here are solved for such a tree by Rayleigh and Ritz's method, as nothing
// so simple as a formula gives them, and written as polynomials a shader can work out
// for every pixel. The test works them out again from the physics. Nothing here touches
// a GPU, so all of it can be tested.

/** The width of a trunk at its top, as a share of its width at the foot. */
export const TAPER = 0.15

/** The weight of a crown, as a share of its trunk's, and how far up the trunk it starts. */
export const CROWN_WEIGHT = 0.6
export const CROWN_FROM = 0.55

/** How much faster a tree's second shape goes than its first, as it comes out for such a tree. */
export const SECOND_SHAPE_RATE = 3.357

/** The polynomials, from the power of 2 up: a fixed end has no slope, so they start there. */
export const FIRST_SHAPE = [0.39748, -0.09003, 2.22696, -4.99997, 5.90071, -2.43515]
export const SECOND_SHAPE = [-0.86585, -5.08291, 26.45372, -64.08735, 70.41242, -25.83002]

/** A shape at `along` of a trunk, from 0 at the ground to 1 at the top, where it is always 1. */
export function polynomial(terms: readonly number[], along: number) {
  return terms.reduceRight((sum, term) => sum * along + term, 0) * along * along
}

/** How a beam fixed at one end bends under a load at its tip, 0–1, which is how a branch goes. */
export function tipBend(along: number) {
  return (along * along * (3 - along)) / 2
}

/** How many heights up a trunk a part of the panorama can be at. */
export const SHAPE_HEIGHTS = 256

/**
 * Both shapes at each of those heights, in turn. Every pixel looks a few of these up, and
 * a table of them is far quicker for a browser to compile than the polynomials over and
 * over, as well as to run.
 */
export function shapeTable() {
  const table = new Float32Array(SHAPE_HEIGHTS * 2)
  for (let height = 0; height < SHAPE_HEIGHTS; height++) {
    const along = height / (SHAPE_HEIGHTS - 1)
    table[height * 2] = polynomial(FIRST_SHAPE, along)
    table[height * 2 + 1] = polynomial(SECOND_SHAPE, along)
  }
  return table
}

const horner = (terms: readonly number[]) => terms.reduceRight((inner, term) => `(${term} + x * ${inner})`, '0.0')

/** The first shape in WGSL. The second is only ever looked up in the table. */
export const firstShapeSource = /* wgsl */ `
fn firstShape(x: f32) -> f32 {
  return x * x * ${horner(FIRST_SHAPE)};
}
`

/** `tipBend` in WGSL. */
export const tipBendSource = /* wgsl */ `
fn tipBend(x: f32) -> f32 {
  return x * x * (3.0 - x) * 0.5;
}
`
