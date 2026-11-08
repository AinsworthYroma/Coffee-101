export const origins = [
  {
    id: 'amerique-du-sud', name: 'Amérique du Sud', latitude: -20, longitude: -44,
    intro: 'Des montagnes andines aux hauts plateaux brésiliens, les paysages et les cafés changent beaucoup d’un lieu à l’autre.',
    countries: 'Par exemple : Brésil et Pérou.',
    cup: 'Un lot péruvien étudié évoquait le chocolat et les fruits à coque. D’autres cafés peuvent raconter une tout autre histoire.',
    altitude: 'Dans la Mantiqueira, au Brésil, une étude distingue notamment des parcelles entre 1 000 et 1 200 m. Un lot étudié en Amazonas, au Pérou, provenait de 1 600 m. Ce ne sont pas les limites de culture du continent.',
    processing: ['lave', 'nature', 'honey', 'fermentations'],
    processingText: 'Au Pérou, des lots d’Alto Inambari ont été étudiés avec différents traitements, dont lavé, nature et honey, ainsi qu’une fermentation à oxygène limité.',
    sources: [
      { label: 'Mantiqueira, parcelles et altitude', url: 'https://doi.org/10.25186/cs.v14i1.1522' },
      { label: 'Lots du Pérou et d’Éthiopie, conditions et arômes', url: 'https://doi.org/10.1038/s41598-025-16126-x' },
      { label: 'Traitements à Alto Inambari, Pérou', url: 'https://doi.org/10.25186/.v18i.2111' },
    ],
  },
  {
    id: 'afrique-de-l-est', name: 'Afrique de l’Est', latitude: -1, longitude: 37,
    intro: 'L’Éthiopie est le berceau de l’arabica ; les cafés de cette partie de l’Afrique reflètent des terroirs et des pratiques variés.',
    countries: 'Par exemple : Éthiopie et Kenya.',
    cup: 'Un lot éthiopien étudié évoquait les agrumes, la pêche et les fleurs. Ces notes sont des pistes, pas une promesse pour chaque café.',
    altitude: 'À Gedeo, en Éthiopie, une étude cartographique classe 1 400 à 1 800 m comme particulièrement favorables à l’agroforesterie caféière. Un lot étudié en Sidamo / Arsi occidental provenait de 2 065 m ; ces exemples ne délimitent pas toute la production.',
    processing: ['lave', 'nature'],
    processingText: 'En Éthiopie, les études citées présentent notamment un lot lavé et des échantillons traités par voie sèche, dite nature.',
    sources: [
      { label: 'Cartographie caféière de Gedeo, Éthiopie', url: 'https://doi.org/10.3390/s24196287' },
      { label: 'Lots du Pérou et d’Éthiopie, conditions et arômes', url: 'https://doi.org/10.1038/s41598-025-16126-x' },
      { label: 'Cafés éthiopiens traités par voie sèche', url: 'https://doi.org/10.3389/fnut.2024.1390515' },
      { label: 'Origine de l’arabica en Éthiopie', url: 'https://doi.org/10.1007/s11084-025-09690-9' },
      { label: 'World Coffee Research : Kenya', url: 'https://worldcoffeeresearch.org/countries/kenya' },
    ],
  },
  {
    id: 'asie', name: 'Asie', latitude: 4, longitude: 99,
    intro: 'De l’Indonésie au Vietnam, l’Asie réunit des îles, des hauts plateaux et des traditions caféières très différentes.',
    countries: 'Par exemple : Indonésie et Vietnam.',
    cup: 'Dans une étude indonésienne, certains arabicas évoquaient les fleurs, les épices et les fruits. Le résultat varie selon le lot et sa préparation.',
    altitude: 'Dans les hauts plateaux de Gayo, à Sumatra, une étude compare des parcelles entre 1 000 et 1 600 m. Cette plage décrit les parcelles étudiées, pas toute l’Asie.',
    processing: ['nature', 'wet-hulled', 'fermentations'],
    processingText: 'À Sumatra, le décorticage humide est documenté pour le Mandheling. À Gayo, des chercheurs ont aussi étudié une fermentation à oxygène limité sur du café non lavé.',
    sources: [
      { label: 'Parcelles de Gayo, Indonésie', url: 'https://doi.org/10.1088/1755-1315/1356/1/012030' },
      { label: 'Profils de lots arabica en Indonésie', url: 'https://doi.org/10.22302/iccri.jur.pelitaperkebunan.v36i1.409' },
      { label: 'Décorticage humide à Sumatra', url: 'https://doi.org/10.22302/iccri.jur.pelitaperkebunan.v21i2.20' },
      { label: 'Fermentation à Gayo', url: 'https://doi.org/10.22302/iccri.jur.pelitaperkebunan.v37i3.464' },
      { label: 'World Coffee Research : Vietnam', url: 'https://worldcoffeeresearch.org/countries/vietnam' },
    ],
  },
] as const

export type OriginId = (typeof origins)[number]['id']