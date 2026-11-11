// What there is to see in a dark sky with the eye alone, where it really is. Data only:
// celestial.ts places it, stars.ts and galaxy.ts make it into what the GPU draws.

/** A star: right ascension in hours, declination in degrees, magnitude and B−V colour. */
export type CatalogStar = [number, number, number, number]

/**
 * The stars that draw the constellations: every star brighter than magnitude 2.3, and
 * nearly every one to 3, with the fainter ones that finish the best-known shapes. Fainter
 * than these, the sky's stars are made up, as many of each brightness as there really are.
 */
export const BRIGHT_STARS: CatalogStar[] = [
  [6.752, -16.72, -1.46, 0], // Sirius
  [6.399, -52.7, -0.74, 0.15], // Canopus
  [14.66, -60.84, -0.27, 0.71], // Alpha Centauri
  [14.261, 19.18, -0.05, 1.23], // Arcturus
  [18.616, 38.78, 0.03, 0], // Vega
  [5.278, 46, 0.08, 0.8], // Capella
  [5.242, -8.2, 0.13, -0.03], // Rigel
  [7.655, 5.22, 0.34, 0.42], // Procyon
  [1.629, -57.24, 0.46, -0.16], // Achernar
  [5.919, 7.41, 0.5, 1.85], // Betelgeuse
  [14.064, -60.37, 0.61, -0.23], // Hadar
  [19.846, 8.87, 0.76, 0.22], // Altair
  [12.443, -63.1, 0.76, -0.24], // Acrux
  [4.599, 16.51, 0.86, 1.54], // Aldebaran
  [16.49, -26.43, 0.96, 1.83], // Antares
  [13.42, -11.16, 0.97, -0.24], // Spica
  [7.755, 28.03, 1.14, 1], // Pollux
  [22.961, -29.62, 1.16, 0.09], // Fomalhaut
  [20.69, 45.28, 1.25, 0.09], // Deneb
  [12.795, -59.69, 1.25, -0.24], // Mimosa
  [10.14, 11.97, 1.35, -0.11], // Regulus
  [6.977, -28.97, 1.5, -0.21], // Adhara
  [7.577, 31.89, 1.58, 0.03], // Castor
  [17.56, -37.1, 1.62, -0.22], // Shaula
  [12.519, -57.11, 1.63, 1.6], // Gacrux
  [5.419, 6.35, 1.64, -0.22], // Bellatrix
  [5.438, 28.61, 1.65, -0.13], // Elnath
  [9.22, -69.72, 1.69, 0], // Miaplacidus
  [5.604, -1.2, 1.69, -0.18], // Alnilam
  [22.137, -46.96, 1.74, -0.07], // Alnair
  [5.679, -1.94, 1.77, -0.21], // Alnitak
  [12.9, 55.96, 1.77, -0.02], // Alioth
  [11.062, 61.75, 1.79, 1.07], // Dubhe
  [3.405, 49.86, 1.8, 0.48], // Mirfak
  [7.14, -26.39, 1.83, 0.67], // Wezen
  [8.159, -47.34, 1.83, -0.22], // Gamma Velorum
  [18.403, -34.38, 1.85, -0.03], // Kaus Australis
  [17.622, -43, 1.86, 0.4], // Sargas
  [13.792, 49.31, 1.86, -0.1], // Alkaid
  [8.375, -59.51, 1.86, 1.2], // Avior
  [5.992, 44.95, 1.9, 0.03], // Menkalinan
  [16.811, -69.03, 1.91, 1.45], // Atria
  [6.628, 16.4, 1.93, 0], // Alhena
  [20.427, -56.74, 1.94, -0.2], // Peacock
  [8.745, -54.71, 1.96, 0.04], // Delta Velorum
  [2.53, 89.26, 1.98, 0.6], // Polaris
  [6.378, -17.96, 1.98, -0.24], // Mirzam
  [9.46, -8.66, 1.98, 1.44], // Alphard
  [10.333, 19.84, 2.01, 1.15], // Algieba
  [2.12, 23.46, 2, 1.15], // Hamal
  [0.727, -17.99, 2.04, 1.02], // Diphda
  [18.921, -26.3, 2.05, -0.13], // Nunki
  [14.111, -36.37, 2.06, 1.01], // Menkent
  [0.14, 29.09, 2.06, -0.1], // Alpheratz
  [1.163, 35.62, 2.06, 1.57], // Mirach
  [22.711, -46.88, 2.07, 1.6], // Beta Gruis
  [5.796, -9.67, 2.07, -0.17], // Saiph
  [17.582, 12.56, 2.07, 0.15], // Rasalhague
  [14.845, 74.16, 2.08, 1.47], // Kochab
  [2.065, 42.33, 2.1, 1.37], // Almach
  [3.136, 40.96, 2.12, -0.05], // Algol
  [11.818, 14.57, 2.14, 0.09], // Denebola
  [0.945, 60.72, 2.15, -0.15], // Gamma Cassiopeiae
  [12.692, -48.96, 2.17, -0.01], // Gamma Centauri
  [9.285, -59.28, 2.21, 0.18], // Aspidiske
  [9.133, -43.43, 2.21, 1.66], // Suhail
  [15.578, 26.71, 2.22, -0.02], // Alphecca
  [5.533, -0.3, 2.23, -0.18], // Mintaka
  [20.37, 40.26, 2.23, 0.67], // Sadr
  [13.399, 54.93, 2.23, 0.02], // Mizar
  [0.675, 56.54, 2.24, 1.17], // Schedar
  [17.943, 51.49, 2.24, 1.52], // Eltanin
  [8.06, -40, 2.25, -0.27], // Naos
  [0.153, 59.15, 2.27, 0.34], // Caph
  [16.006, -22.62, 2.29, -0.12], // Dschubba
  [16.836, -34.29, 2.29, 1.15], // Larawag
  [14.699, -47.39, 2.3, -0.15], // Alpha Lupi
  [13.665, -53.47, 2.3, -0.17], // Epsilon Centauri
  [14.592, -42.16, 2.35, -0.16], // Eta Centauri
  [14.75, 27.07, 2.37, 0.97], // Izar
  [11.031, 56.38, 2.37, -0.02], // Merak
  [21.736, 9.88, 2.38, 1.53], // Enif
  [17.708, -39.03, 2.39, -0.17], // Kappa Scorpii
  [0.438, -42.31, 2.4, 1.09], // Ankaa
  [11.897, 53.69, 2.44, 0], // Phecda
  [17.173, -15.72, 2.43, 0.06], // Sabik
  [23.063, 28.08, 2.42, 1.67], // Scheat
  [7.401, -29.3, 2.45, -0.08], // Aludra
  [9.368, -55.01, 2.47, -0.14], // Markeb
  [20.77, 33.97, 2.48, 1.03], // Aljanah
  [23.079, 15.21, 2.49, -0.04], // Markab
  [3.038, 4.09, 2.54, 1.64], // Menkar
  [12.139, -50.72, 2.52, -0.12], // Delta Centauri
  [13.926, -47.29, 2.55, -0.22], // Zeta Centauri
  [16.619, -10.57, 2.56, 0.02], // Zeta Ophiuchi
  [11.235, 20.52, 2.56, 0.12], // Zosma
  [5.546, -17.82, 2.58, 0.21], // Arneb
  [12.263, -17.54, 2.59, -0.11], // Gienah Corvi
  [19.043, -29.88, 2.6, 0.08], // Ascella
  [15.283, -9.38, 2.61, -0.11], // Zubeneschamali
  [5.995, 37.21, 2.62, -0.08], // Mahasim
  [16.091, -19.81, 2.62, -0.07], // Acrab
  [12.573, -23.4, 2.65, 0.89], // Kraz
  [5.661, -34.07, 2.65, -0.12], // Phact
  [4.95, 33.17, 2.69, 1.53], // Hassaleh
  [17.513, -37.3, 2.69, -0.22], // Lesath
  [14.976, -43.13, 2.68, -0.22], // Beta Lupi
  [13.911, 18.4, 2.68, 0.58], // Muphrid
  [1.43, 60.24, 2.68, 0.13], // Ruchbah
  [7.286, -37.1, 2.7, 1.62], // Pi Puppis
  [18.35, -29.83, 2.7, 1.38], // Kaus Media
  [19.771, 10.61, 2.72, 1.52], // Tarazed
  [16.239, -3.69, 2.73, 1.58], // Yed Prior
  [12.694, -1.45, 2.74, 0.36], // Porrima
  [14.848, -16.04, 2.75, 0.15], // Zubenelgenubi
  [10.716, -64.39, 2.76, -0.22], // Theta Carinae
  [5.59, -5.91, 2.77, -0.24], // Hatysa
  [16.504, 21.49, 2.77, 0.94], // Kornephoros
  [17.725, 4.57, 2.77, 1.16], // Cebalrai
  [12.252, -58.75, 2.79, -0.23], // Imai
  [5.131, -5.09, 2.79, 0.13], // Cursa
  [17.507, 52.3, 2.79, 0.98], // Rastaban
  [0.429, -77.25, 2.8, 0.62], // Beta Hydri
  [18.466, -25.42, 2.81, 1.04], // Kaus Borealis
  [16.688, 31.6, 2.81, 0.65], // Zeta Herculis
  [16.598, -28.22, 2.82, -0.25], // Paikauhale
  [0.22, 15.18, 2.83, -0.23], // Algenib
  [13.036, 10.96, 2.83, 0.94], // Vindemiatrix
  [5.471, -20.76, 2.84, 0.82], // Nihal
  [21.784, -16.13, 2.85, 0.29], // Deneb Algedi
  [3.902, 31.88, 2.85, 0.27], // Zeta Persei
  [17.422, -55.53, 2.85, 1.46], // Beta Arae
  [15.919, -63.43, 2.85, 0.29], // Beta Trianguli Australis
  [21.526, -5.57, 2.87, 0.83], // Sadalsuud
  [19.75, 45.13, 2.87, -0.03], // Fawaris
  [6.383, 22.51, 2.87, 1.64], // Tejat
  [3.964, 40.01, 2.88, -0.18], // Epsilon Persei
  [15.315, -68.68, 2.89, 0], // Gamma Trianguli Australis
  [15.981, -26.11, 2.89, -0.19], // Fang
  [7.453, 8.29, 2.89, -0.09], // Gomeisa
  [16.353, -25.59, 2.9, 0.13], // Alniyat
  [22.096, -0.32, 2.94, 0.98], // Sadalmelik
  [12.498, -16.52, 2.95, -0.05], // Algorab
  [3.967, -13.51, 2.95, 1.59], // Zaurak
  [17.531, -49.88, 2.95, -0.17], // Alpha Arae
  [6.732, 25.13, 2.98, 1.4], // Mebsuta
  [9.764, 23.77, 2.98, 0.81], // Ras Elased
  [18.097, -30.42, 2.99, 1], // Alnasl
  [19.09, 13.86, 2.99, 0.01], // Okab
  [12.169, -22.62, 3, 1.33], // Minkar
  [15.345, 71.83, 3, 0.05], // Pherkad
  [5.627, 21.14, 3, -0.19], // Tianguan
  [17.793, -40.13, 3.03, 0.51], // Iota Scorpii
  [14.535, 38.31, 3.03, 0.19], // Seginus
  [16.864, -38.05, 3.04, -0.2], // Xamidimura
  [19.512, 27.96, 3.05, 1.13], // Albireo
  [18.761, -26.99, 3.17, -0.11], // Phi Sagittarii
  [16.961, 9.38, 3.2, 1.15], // Kappa Ophiuchi
  [20.188, -0.82, 3.24, 0.32], // Theta Aquilae
  [18.982, 32.69, 3.25, -0.05], // Sulafat
  [6.248, 22.51, 3.28, 1.6], // Propus
  [12.257, 57.03, 3.31, 0.08], // Megrez
  [17.203, -43.24, 3.33, 0.41], // Eta Scorpii
  [11.237, 15.43, 3.33, 0], // Chertan
  [19.116, -27.67, 3.32, 1.19], // Tau Sagittarii
  [19.425, 3.11, 3.36, 0.32], // Delta Aquilae
  [1.906, 63.67, 3.37, -0.15], // Segin
  [5.585, 9.93, 3.39, -0.16], // Meissa
  [19.104, -4.88, 3.43, 0.01], // Lambda Aquilae
  [10.278, 23.42, 3.44, 0.31], // Adhafera
  [10.122, 16.76, 3.48, -0.03], // Eta Leonis
  [7.335, 21.98, 3.53, 0.34], // Wasat
  [18.835, 33.36, 3.52, 0], // Sheliak
  [16.91, -42.36, 3.62, 1.37], // Zeta Scorpii
  [9.879, 26.01, 3.88, 1.22], // Rasalas
  // The Hyades, the V of the bull's face.
  [4.478, 15.87, 3.4, 0.18], // Theta² Tauri
  [4.477, 19.18, 3.53, 1.01], // Ain
  [4.33, 15.63, 3.65, 0.99], // Prima Hyadum
  [4.382, 17.54, 3.76, 0.98], // Secunda Hyadum
  [4.476, 15.96, 3.84, 0.95], // Theta¹ Tauri
  // The Pleiades.
  [3.791, 24.11, 2.87, -0.09], // Alcyone
  [3.819, 24.05, 3.62, -0.08], // Atlas
  [3.748, 24.11, 3.7, -0.11], // Electra
  [3.764, 24.37, 3.87, -0.07], // Maia
  [3.772, 23.95, 4.18, -0.06], // Merope
  [3.754, 24.47, 4.3, -0.11], // Taygeta
  [3.82, 24.14, 5.05, -0.08], // Pleione
  [3.748, 24.29, 5.45, -0.04], // Celaeno
  [3.754, 24.55, 5.76, -0.04], // Asterope
]

/**
 * Something with a size, on the sky or in the galaxy: where its middle is, how far it
 * reaches along its length and across it, in degrees, how its length lies, in degrees,
 * and how strong it is.
 */
export interface Patch {
  /** Galactic longitude and latitude, in degrees, or right ascension in hours and declination in degrees. */
  at: [number, number]
  /** How far it reaches each way along its length and across it, in degrees: the spread of a Gaussian. */
  long: number
  wide: number
  /** How its length lies: from the way of growing longitude towards growing latitude, or from north through east. */
  tilt: number
  strength: number
}

/**
 * The band of the Milky Way, as lobes of light along the galactic plane, each by its
 * galactic longitude and latitude in degrees, its spread in longitude and in latitude,
 * and how bright it is. Brightest and broadest towards the centre in Sagittarius, with
 * a second rise in Cygnus and a third through Carina and Centaurus, and faint away
 * from the centre, in Auriga and Taurus.
 */
export const DISK_LOBES: Patch[] = [
  { at: [0, 0], long: 1000, wide: 6, tilt: 0, strength: 0.12 },
  { at: [0, 0], long: 1000, wide: 18, tilt: 0, strength: 0.05 },
  { at: [0, -0.5], long: 36, wide: 7, tilt: 0, strength: 0.45 },
  { at: [75, 0.5], long: 13, wide: 4.5, tilt: 0, strength: 0.32 },
  { at: [-75, -0.5], long: 24, wide: 3.5, tilt: 0, strength: 0.3 },
  { at: [-30, -1], long: 14, wide: 3.5, tilt: 0, strength: 0.2 },
  { at: [125, 0], long: 24, wide: 4, tilt: 0, strength: 0.08 },
  { at: [-105, -1], long: 20, wide: 4, tilt: 0, strength: 0.08 },
]

/** The bulge at the centre, which stands out of the band in Sagittarius and Scorpius. */
export const BULGE: Patch = { at: [0, -2], long: 9, wide: 7, tilt: 0, strength: 0.55 }

/** The brightest star clouds of the band, in galactic coordinates. */
export const STAR_CLOUDS: Patch[] = [
  { at: [2.5, -5.5], long: 3.6, wide: 2.6, tilt: -20, strength: 0.75 }, // Large Sagittarius Star Cloud
  { at: [12, -0.8], long: 1.1, wide: 0.7, tilt: 0, strength: 0.7 }, // Small Sagittarius Star Cloud
  { at: [27, -2.5], long: 2.8, wide: 2.2, tilt: 30, strength: 0.75 }, // Scutum Star Cloud
  { at: [355.7, -4.5], long: 1.8, wide: 1.5, tilt: 0, strength: 0.4 }, // around Ptolemy's Cluster
  { at: [76, 1.5], long: 6, wide: 2.5, tilt: 10, strength: 0.45 }, // Cygnus Star Cloud
  { at: [40, -3], long: 5, wide: 2.5, tilt: 0, strength: 0.25 }, // in Aquila
  { at: [329, -2.5], long: 3, wide: 2, tilt: 0, strength: 0.45 }, // Norma Star Cloud
  { at: [287, -1], long: 6, wide: 3, tilt: 0, strength: 0.45 }, // around the Carina Nebula
  { at: [310, 0], long: 6, wide: 2.5, tilt: 0, strength: 0.3 }, // in Centaurus
  { at: [265, -1], long: 6, wide: 3, tilt: 0, strength: 0.22 }, // in Vela
]

/**
 * The dust that darkens the band, in galactic coordinates: the Great Rift that splits
 * it from Cygnus down to Sagittarius, the dark nebulae that hang off it in Ophiuchus,
 * and the Coalsack beside the Southern Cross. Strength is how much light the thickest
 * of it stops, 0–1.
 */
export const DARK_CLOUDS: Patch[] = [
  { at: [85.5, 0.8], long: 2, wide: 1.5, tilt: 0, strength: 0.6 }, // Northern Coalsack, by Deneb
  { at: [72, 1], long: 8, wide: 1.4, tilt: 0, strength: 0.7 }, // the Cygnus Rift
  { at: [57, 1.5], long: 7, wide: 1.5, tilt: -8, strength: 0.6 }, // through Vulpecula
  { at: [36, 2.5], long: 8, wide: 2, tilt: -20, strength: 0.8 }, // the Aquila Rift
  { at: [22, 4.5], long: 7, wide: 2.2, tilt: -18, strength: 0.75 }, // in Serpens
  { at: [10, 6.5], long: 6, wide: 2, tilt: -10, strength: 0.65 }, // in Ophiuchus
  { at: [10, 1.5], long: 15, wide: 0.9, tilt: 0, strength: 0.45 }, // along the plane in Sagittarius
  { at: [359, 5.5], long: 5, wide: 1.1, tilt: -35, strength: 0.75 }, // the Pipe Nebula
  { at: [1.5, 3.8], long: 1.6, wide: 1.2, tilt: 0, strength: 0.7 }, // the Pipe's bowl, B78
  { at: [356, 11], long: 6, wide: 1.4, tilt: 60, strength: 0.4 }, // streamers to Rho Ophiuchi
  { at: [353, 17], long: 4, wide: 2.6, tilt: 20, strength: 0.55 }, // the Rho Ophiuchi cloud
  { at: [320, 1], long: 9, wide: 1.4, tilt: 0, strength: 0.45 }, // in Norma and Circinus
  { at: [301, -1], long: 3.2, wide: 2.4, tilt: 15, strength: 0.85 }, // the Coalsack
  { at: [172, -15], long: 8, wide: 4, tilt: 30, strength: 0.3 }, // the Taurus dark clouds
]

/** Whether something away from the band is a galaxy, a nebula or a cluster too far for the eye to split. */
export type DeepSkyKind = 'galaxy' | 'nebula' | 'cluster'

export interface DeepSky extends Patch {
  kind: DeepSkyKind
}

/**
 * What else shows as a glow to the eye alone: the Magellanic Clouds, Andromeda, the
 * brightest nebulae and the clusters that look like fuzzy stars. By right ascension in
 * hours and declination in degrees, with lengths tilted from north through east.
 */
export const DEEP_SKY: DeepSky[] = [
  { kind: 'galaxy', at: [5.392, -69.76], long: 3.6, wide: 2.9, tilt: 170, strength: 0.42 }, // Large Magellanic Cloud
  { kind: 'galaxy', at: [5.35, -69.5], long: 1.8, wide: 0.45, tilt: 115, strength: 0.4 }, // its bar
  { kind: 'nebula', at: [5.646, -69.1], long: 0.25, wide: 0.22, tilt: 0, strength: 0.6 }, // the Tarantula
  { kind: 'galaxy', at: [0.877, -72.83], long: 1.7, wide: 0.9, tilt: 45, strength: 0.38 }, // Small Magellanic Cloud
  { kind: 'galaxy', at: [0.712, 41.27], long: 1.1, wide: 0.3, tilt: 38, strength: 0.25 }, // Andromeda
  { kind: 'galaxy', at: [0.712, 41.27], long: 0.22, wide: 0.15, tilt: 38, strength: 0.6 }, // its core
  { kind: 'galaxy', at: [1.564, 30.66], long: 0.35, wide: 0.22, tilt: 23, strength: 0.08 }, // Triangulum
  { kind: 'nebula', at: [5.588, -5.39], long: 0.3, wide: 0.25, tilt: 0, strength: 0.7 }, // the Orion Nebula
  { kind: 'nebula', at: [10.752, -59.87], long: 0.8, wide: 0.6, tilt: 30, strength: 0.6 }, // the Carina Nebula
  { kind: 'nebula', at: [18.06, -24.38], long: 0.4, wide: 0.22, tilt: 90, strength: 0.5 }, // the Lagoon Nebula
  { kind: 'cluster', at: [13.447, -47.48], long: 0.14, wide: 0.14, tilt: 0, strength: 0.9 }, // Omega Centauri
  { kind: 'cluster', at: [0.401, -72.08], long: 0.11, wide: 0.11, tilt: 0, strength: 0.75 }, // 47 Tucanae
  { kind: 'cluster', at: [16.695, 36.46], long: 0.06, wide: 0.06, tilt: 0, strength: 0.35 }, // the Hercules Cluster
  { kind: 'cluster', at: [18.607, -23.9], long: 0.1, wide: 0.1, tilt: 0, strength: 0.4 }, // M22
  { kind: 'cluster', at: [8.667, 19.67], long: 0.45, wide: 0.45, tilt: 0, strength: 0.28 }, // the Beehive
  { kind: 'cluster', at: [2.333, 57.14], long: 0.45, wide: 0.22, tilt: 90, strength: 0.32 }, // the Double Cluster
  { kind: 'cluster', at: [17.898, -34.79], long: 0.45, wide: 0.45, tilt: 0, strength: 0.38 }, // Ptolemy's Cluster
  { kind: 'cluster', at: [17.668, -32.25], long: 0.2, wide: 0.15, tilt: 0, strength: 0.3 }, // the Butterfly Cluster
  { kind: 'cluster', at: [3.79, 24.1], long: 0.5, wide: 0.45, tilt: 0, strength: 0.15 }, // the Pleiades, past their brightest
  { kind: 'cluster', at: [10.716, -64.4], long: 0.4, wide: 0.4, tilt: 0, strength: 0.2 }, // the Southern Pleiades
]
