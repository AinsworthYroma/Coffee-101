import type { OriginId } from './origins'

export const originImages: Record<OriginId, { src: string; alt: string; caption: string; author: string; source: string; license: string; licenseUrl: string }> = {
  'amerique-du-sud': {
    src: '/origines/minas-gerais.jpg',
    alt: 'Rangs de caféiers à Fazenda Da Lagoa, au Brésil',
    caption: 'Fazenda Da Lagoa, Minas Gerais, Brésil',
    author: 'Knase',
    source: 'https://commons.wikimedia.org/wiki/File:Fazenda_Da_Lagoa.jpg',
    license: 'CC BY 3.0 DE',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/de/',
  },
  'afrique-de-l-est': {
    src: '/origines/ouganda.jpg',
    alt: 'Caféiers et bananiers cultivés ensemble en Ouganda',
    caption: 'Caféiers et bananiers, Ouganda',
    author: 'Kateregga1',
    source: 'https://commons.wikimedia.org/wiki/File:Coffee_and_banana_plantation_in_Uganda.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'asie': {
    src: '/origines/gumitir.jpg',
    alt: 'Caféiers sous les arbres sur le mont Gumitir, en Indonésie',
    caption: 'Mont Gumitir, Indonésie',
    author: 'Okkisafire',
    source: 'https://commons.wikimedia.org/wiki/File:Coffee_plantation_on_Gumitir.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
}